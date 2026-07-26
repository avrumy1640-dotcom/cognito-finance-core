/**
 * Address autocomplete behind a single swappable provider interface.
 *
 * Currently backed by OpenStreetMap Nominatim (no API key, no signup). To move
 * to Google Places later, implement the same `AddressProvider` shape and swap
 * the `provider` constant below — no call sites change.
 */

export interface AddressSuggestion {
  /** Full human-readable label shown in the dropdown. */
  label: string;
  street: string;
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

export const provider: AddressProvider = nominatim;

export const searchAddresses = (
  query: string,
  opts?: { signal?: AbortSignal; country?: string },
) => provider.search(query, opts);
