import { useMemo, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, countryByCode, splitE164, formatNational, MAX_NATIONAL_DIGITS } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  /** Full E.164 value, e.g. "+19294563064". */
  value: string;
  onChange: (e164: string) => void;
  defaultCountry?: string;
  error?: string | null;
  hint?: string;
}

/**
 * Dial-code selector + digits-only national number field.
 * The user never types "+" — the combined E.164 value is emitted automatically.
 */
const PhoneField = ({
  label = "Mobile number", value, onChange, defaultCountry = "US", error, hint,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [override, setOverride] = useState<string | null>(null);

  const parsed = useMemo(() => splitE164(value, defaultCountry), [value, defaultCountry]);
  const country = override ?? parsed.country;
  const dial = countryByCode(country)?.dial ?? "+1";

  const emit = (cc: string, national: string) => {
    const d = national.replace(/\D/g, "").slice(0, MAX_NATIONAL_DIGITS);
    const code = countryByCode(cc)?.dial ?? "+1";
    onChange(d ? `${code}${d}` : "");
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase() === q)
    : COUNTRIES;

  return (
    <div>
      <label className="text-xs text-muted-foreground font-semibold mb-1.5 block uppercase tracking-wide">
        {label}
      </label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Country dial code"
              className={cn(
                "px-3 py-3.5 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center gap-1.5 shrink-0 border-2 outline-none transition-colors",
                error ? "border-destructive/60" : "border-transparent focus:border-primary/40"
              )}
            >
              <span className="text-base leading-none">{countryByCode(country)?.flag ?? "🌐"}</span>
              <span className="tabular-nums">{dial}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-64">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search size={14} className="text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country"
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { setOverride(c.code); emit(c.code, parsed.national); setOpen(false); setQuery(""); }}
                  className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-left hover:bg-secondary transition-colors"
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{c.dial}</span>
                  {c.code === country && <Check size={14} className="text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-label={label}
          value={formatNational(parsed.national, country)}
          onChange={(e) => emit(country, e.target.value)}
          placeholder={country === "US" || country === "CA" ? "(555) 123-4567" : "555 123 4567"}
          className={cn(
            "flex-1 min-w-0 p-3.5 rounded-xl bg-secondary text-foreground text-sm border-2 outline-none transition-colors",
            error ? "border-destructive/60" : "border-transparent focus:border-primary/40 focus:bg-card"
          )}
        />
      </div>
      {error ? (
        <p className="text-[11px] text-destructive mt-1.5 font-medium">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
};

export default PhoneField;
