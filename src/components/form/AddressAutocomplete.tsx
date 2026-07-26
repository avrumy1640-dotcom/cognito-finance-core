import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { searchAddresses, type AddressSuggestion } from "@/lib/addressAutocomplete";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Called when the user picks a suggestion — fills the whole address block. */
  onSelect: (s: AddressSuggestion) => void;
  error?: string | null;
  placeholder?: string;
  /** Bias results to a country (ISO2). Optional. */
  country?: string;
}

/**
 * Street-address field with debounced autocomplete. Suggestions are advisory —
 * the user can always ignore them and keep typing manually.
 */
const AddressAutocomplete = ({ label, value, onChange, onSelect, error, placeholder, country }: Props) => {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const skipRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setItems([]); setLoading(false); setOpen(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchAddresses(q, { signal: ctrl.signal, country });
        setItems(res);
        setActive(-1);
        setOpen(res.length > 0);
      } catch {
        /* network/aborted — manual entry still works */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, country]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (s: AddressSuggestion) => {
    skipRef.current = true;
    onSelect(s);
    setOpen(false);
    setItems([]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <label className="text-xs text-muted-foreground font-semibold mb-1.5 block uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          aria-label={label}
          aria-invalid={!!error}
          aria-autocomplete="list"
          aria-expanded={open}
          autoComplete="off"
          role="combobox"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Start typing your address"}
          className={cn(
            "w-full p-3.5 pr-10 rounded-xl bg-secondary text-foreground text-sm border-2 outline-none transition-colors placeholder:text-muted-foreground/60",
            error ? "border-destructive/60" : "border-transparent focus:border-primary/40",
          )}
        />
        {loading && (
          <Loader2 size={15} className="animate-spin text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2" />
        )}
      </div>
      {error && <p className="text-[11px] text-destructive mt-1.5 font-medium">{error}</p>}

      {open && items.length > 0 && (
        <ul
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-40 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl max-h-60 overflow-y-auto py-1"
        >
          {items.map((s, i) => (
            <li key={`${s.label}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={cn(
                  "w-full px-3 py-2.5 flex items-start gap-2 text-left transition-colors",
                  i === active ? "bg-secondary" : "hover:bg-secondary",
                )}
              >
                <MapPin size={13} className="text-primary mt-0.5 shrink-0" />
                <span className="text-xs text-foreground leading-snug">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
