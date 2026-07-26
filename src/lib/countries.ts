export interface Country {
  code: string;
  name: string;
  flag: string;
  dial: string;
}

/** ISO2 → name / flag / dial code. Ordered with common markets first. */
export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", flag: "🇺🇸", dial: "+1" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dial: "+1" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dial: "+44" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", dial: "+353" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dial: "+49" },
  { code: "FR", name: "France", flag: "🇫🇷", dial: "+33" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dial: "+34" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dial: "+351" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dial: "+39" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dial: "+31" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", dial: "+32" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", dial: "+352" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", dial: "+41" },
  { code: "AT", name: "Austria", flag: "🇦🇹", dial: "+43" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", dial: "+45" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", dial: "+46" },
  { code: "NO", name: "Norway", flag: "🇳🇴", dial: "+47" },
  { code: "FI", name: "Finland", flag: "🇫🇮", dial: "+358" },
  { code: "IS", name: "Iceland", flag: "🇮🇸", dial: "+354" },
  { code: "PL", name: "Poland", flag: "🇵🇱", dial: "+48" },
  { code: "CZ", name: "Czechia", flag: "🇨🇿", dial: "+420" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰", dial: "+421" },
  { code: "HU", name: "Hungary", flag: "🇭🇺", dial: "+36" },
  { code: "RO", name: "Romania", flag: "🇷🇴", dial: "+40" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", dial: "+359" },
  { code: "GR", name: "Greece", flag: "🇬🇷", dial: "+30" },
  { code: "HR", name: "Croatia", flag: "🇭🇷", dial: "+385" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮", dial: "+386" },
  { code: "EE", name: "Estonia", flag: "🇪🇪", dial: "+372" },
  { code: "LV", name: "Latvia", flag: "🇱🇻", dial: "+371" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹", dial: "+370" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾", dial: "+357" },
  { code: "MT", name: "Malta", flag: "🇲🇹", dial: "+356" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", dial: "+380" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷", dial: "+90" },
  { code: "IL", name: "Israel", flag: "🇮🇱", dial: "+972" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", dial: "+971" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dial: "+966" },
  { code: "QA", name: "Qatar", flag: "🇶🇦", dial: "+974" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", dial: "+965" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭", dial: "+973" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", dial: "+27" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dial: "+234" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dial: "+254" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dial: "+233" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", dial: "+20" },
  { code: "MA", name: "Morocco", flag: "🇲🇦", dial: "+212" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", dial: "+52" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dial: "+55" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", dial: "+54" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dial: "+56" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", dial: "+57" },
  { code: "PE", name: "Peru", flag: "🇵🇪", dial: "+51" },
  { code: "PA", name: "Panama", flag: "🇵🇦", dial: "+507" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴", dial: "+1" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲", dial: "+1" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dial: "+61" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", dial: "+64" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dial: "+81" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", dial: "+82" },
  { code: "CN", name: "China", flag: "🇨🇳", dial: "+86" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", dial: "+852" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", dial: "+886" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", dial: "+65" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", dial: "+60" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", dial: "+66" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", dial: "+84" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", dial: "+63" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", dial: "+62" },
  { code: "IN", name: "India", flag: "🇮🇳", dial: "+91" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", dial: "+92" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", dial: "+880" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", dial: "+94" },
  { code: "NP", name: "Nepal", flag: "🇳🇵", dial: "+977" },
];

export const countryByCode = (code: string): Country | undefined =>
  COUNTRIES.find((c) => c.code === code.toUpperCase());

/** US states + DC and territories, keyed by USPS abbreviation. */
export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "PR", name: "Puerto Rico" }, { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

/** Longest-prefix match of an E.164 string to a known dial code. */
export function splitE164(value: string, fallback = "US"): { country: string; national: string } {
  const raw = (value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      const d = c.dial.replace(/\D/g, "");
      if (digits.startsWith(d)) return { country: c.code, national: digits.slice(d.length) };
    }
  }
  return { country: fallback, national: digits };
}

/** Pretty-print national digits. US/CA get (XXX) XXX-XXXX; others group by 3. */
export function formatNational(digits: string, country: string): string {
  const d = digits.replace(/\D/g, "");
  if ((country === "US" || country === "CA") && d.length) {
    const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6, 10);
    if (d.length <= 3) return `(${a}`;
    if (d.length <= 6) return `(${a}) ${b}`;
    return `(${a}) ${b}-${c}`;
  }
  return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export const MAX_NATIONAL_DIGITS = 15;
