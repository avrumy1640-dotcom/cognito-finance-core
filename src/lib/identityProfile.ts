import { supabase } from "@/integrations/supabase/client";

/* ============================================================================
 * Single source of truth for the identity data the app collects once during
 * onboarding and then reuses everywhere — including the banking partner's
 * `/entities/person` call.
 *
 * RULE: if a field lives here, Onboarding is the ONLY screen allowed to ask
 * for it. Identity verification pre-fills from this shape and never re-prompts
 * for anything already present.
 * ========================================================================== */

export interface IdentityProfile {
  first_name: string;
  last_name: string;
  date_of_birth: string; // yyyy-mm-dd
  phone: string; // E.164
  country: string; // ISO-2 residence
  citizenship: string; // ISO-2
  street: string;
  city: string;
  region: string;
  postal_code: string;
  occupation: string;
  employment_status: string;
  annual_income: string; // digits only
}

export const EMPTY_IDENTITY: IdentityProfile = {
  first_name: "", last_name: "", date_of_birth: "", phone: "",
  country: "", citizenship: "", street: "", city: "", region: "",
  postal_code: "", occupation: "", employment_status: "", annual_income: "",
};

/** Fields that must be present before identity verification can run. */
export const REQUIRED_IDENTITY_FIELDS: (keyof IdentityProfile)[] = [
  "first_name", "last_name", "date_of_birth", "phone", "country", "citizenship",
  "street", "city", "region", "postal_code", "occupation", "employment_status",
  "annual_income",
];

export const splitName = (full: string | null | undefined) => {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};

type ProfileRowish = Record<string, unknown> | null;

/** Maps a `profiles` row onto the shared identity shape. */
export function identityFromProfileRow(row: ProfileRowish): IdentityProfile {
  if (!row) return { ...EMPTY_IDENTITY };
  const str = (k: string) => (typeof row[k] === "string" ? (row[k] as string) : "");
  const { first, last } = splitName(str("preferred_name"));
  return {
    first_name: first,
    last_name: last,
    date_of_birth: str("date_of_birth"),
    phone: str("phone"),
    country: str("country"),
    citizenship: str("citizenship") || str("country"),
    street: str("address_street"),
    line2: str("address_line2"),
    city: str("address_city"),
    region: str("address_region"),
    postal_code: str("address_postal_code"),
    occupation: str("occupation"),
    employment_status: str("employment_status"),
    annual_income: str("annual_income").replace(/[^0-9]/g, ""),
  };
}

/** Loads the signed-in user's shared identity data. */
export async function loadIdentityProfile(userId: string): Promise<IdentityProfile> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return identityFromProfileRow(data as ProfileRowish);
}

/** Which required fields are still missing (legacy accounts, partial drafts). */
export function missingIdentityFields(p: IdentityProfile): (keyof IdentityProfile)[] {
  return REQUIRED_IDENTITY_FIELDS.filter((k) => !String(p[k] ?? "").trim());
}

export const LABELS: Record<keyof IdentityProfile, string> = {
  first_name: "Legal first name",
  last_name: "Legal last name",
  date_of_birth: "Date of birth",
  phone: "Mobile number",
  country: "Country of residence",
  citizenship: "Citizenship",
  street: "Street address",
  city: "City",
  region: "State / region",
  postal_code: "Postal code",
  occupation: "Occupation",
  employment_status: "Employment status",
  annual_income: "Annual income",
};
