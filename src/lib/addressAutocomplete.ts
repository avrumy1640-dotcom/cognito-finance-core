/**
 * Address autocomplete behind a single swappable provider interface.
 *
 * Primary provider is OpenStreetMap Nominatim (no API key, no signup). A second
 * geocoding provider (Photon) is used as a fallback whenever Nominatim errors
 * out, is rate-limited, or returns nothing for a partial address — so a user
 * typing "1600 amphitheatre" still gets their city/state/ZIP filled in.
 *
 * To move to Google Places later, implement the same `AddressProvider` shape
 * and swap the `providers` list below — no call sites change.
 */

export interface AddressSuggestion {
  /** Full human-readable label shown in the dropdown. */
  label: string;
  street: string;
  /** Apt / suite / unit parsed out of the query, when present. */
  unit?: string;
  city: string;
  /** State / region — ISO subdivision code when available, else the name. */
  region: string;
  postal_code: string;
  /** ISO2 country code, uppercase. */
  country: string;
}

export interface AddressProvider {
  name: string;
  search(query: string, opts?: { signal?: AbortSignal; country?: string }): Promise<AddressSuggestion[]>;
}

/** Identifies this app to Nominatim as their usage policy requires. */
const APP_IDENTIFIER = "GlassBankKYC/1.0 (+https://cognito-finance-core.lovable.app)";

interface NominatimResult {
  display_name?: string;
  address?: Record<string, string>;
}

const pick = (a: Record<string, string>, keys: string[]) => {
  for (const k of keys) if (a[k]) return a[k];
  return "";
};

/**
 * Pulls a unit designator ("Apt 4B", "#12", "Suite 300") out of a free-form
 * street string so it can be routed to address line 2 instead of line 1.
 */
export const extractUnit = (input: string): { street: string; unit: string } => {
  const raw = input.trim();
  const m = raw.match(
    /[,\s]+(?:(apt|apartment|unit|ste|suite|fl|floor|rm|room|bldg|building|trlr|lot)\.?\s*|#\s*)([\w-]+)\s*$/i,
  );
  if (!m) return { street: raw, unit: "" };
  const keyword = m[1] ? m[1].replace(/^\w/, (c) => c.toUpperCase()) : "#";
  const unit = keyword === "#" ? `#${m[2]}` : `${keyword} ${m[2]}`;
  return { street: raw.slice(0, m.index).trim().replace(/,$/, ""), unit };
};

const nominatim: AddressProvider = {
  name: "nominatim",
  async search(query, opts) {
    const q = query.trim();
    if (q.length < 3) return [];
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    if (opts?.country) url.searchParams.set("countrycodes", opts.country.toLowerCase());

    const res = await fetch(url.toString(), {
      signal: opts?.signal,
      headers: { Accept: "application/json", "Accept-Language": "en", "X-Requested-With": APP_IDENTIFIER },
    });
    if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
    const rows = (await res.json()) as NominatimResult[];

    return rows.map((r) => {
      const a = r.address ?? {};
      const houseNumber = a.house_number ?? "";
      const road = pick(a, ["road", "pedestrian", "footway", "residential", "neighbourhood"]);
      const street = [houseNumber, road].filter(Boolean).join(" ").trim();
      return {
        label: r.display_name ?? street,
        street: street || pick(a, ["name", "amenity"]),
        city: pick(a, ["city", "town", "village", "municipality", "hamlet", "suburb", "county"]),
        region: pick(a, ["ISO3166-2-lvl4", "state", "province", "region"]).replace(/^[A-Z]{2}-/, ""),
        postal_code: a.postcode ?? "",
        country: (a.country_code ?? "").toUpperCase(),
      };
    });
  },
};

interface PhotonFeature {
  properties?: Record<string, string>;
}

/** Geocoding fallback — tolerant of partial addresses, no API key required. */
const photon: AddressProvider = {
  name: "photon",
  async search(query, opts) {
    const q = query.trim();
    if (q.length < 3) return [];
    const url = new URL("https://photon.komoot.io/api");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    url.searchParams.set("lang", "en");

    const res = await fetch(url.toString(), { signal: opts?.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const wanted = opts?.country?.toUpperCase();

    return (body.features ?? [])
      .map((f) => {
        const p = f.properties ?? {};
        const street = [p.housenumber, p.street || p.name].filter(Boolean).join(" ").trim();
        const city = pick(p, ["city", "town", "village", "district", "county"]);
        const region = pick(p, ["state", "province", "region"]);
        const country = (p.countrycode ?? "").toUpperCase();
        return {
          label: [street || p.name, city, region, p.postcode, p.country].filter(Boolean).join(", "),
          street: street || p.name || "",
          city,
          region,
          postal_code: p.postcode ?? "",
          country,
        } satisfies AddressSuggestion;
      })
      .filter((s) => s.street && (!wanted || !s.country || s.country === wanted));
  },
};

export const providers: AddressProvider[] = [nominatim, photon];

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * Tries each provider in order and returns the first non-empty result set.
 * A provider failing (rate limit, network, CORS) never breaks the flow — the
 * next one is tried, and manual entry always remains available.
 */
export const searchAddresses = async (
  query: string,
  opts?: { signal?: AbortSignal; country?: string },
): Promise<AddressSuggestion[]> => {
  const { street, unit } = extractUnit(query);
  const probe = street.length >= 3 ? street : query;
  let lastError: unknown = null;

  for (const p of providers) {
    if (opts?.signal?.aborted) break;
    try {
      const res = await p.search(probe, opts);
      if (res.length > 0) return unit ? res.map((s) => ({ ...s, unit })) : res;
    } catch (e) {
      if (isAbort(e)) throw e;
      lastError = e;
    }
  }
  if (lastError && !opts?.signal?.aborted) {
    // All providers failed — surface it so the field can offer a manual retry.
    throw lastError instanceof Error ? lastError : new Error("Address lookup unavailable");
  }
  return [];
};
