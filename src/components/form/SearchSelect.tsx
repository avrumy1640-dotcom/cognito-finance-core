import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  prefix?: string;
  hint?: string;
}

interface Props {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  searchPlaceholder?: string;
}

/**
 * Searchable dropdown that shows friendly labels while storing a code value.
 * Styled to match the plain Field inputs used across the KYC flow.
 */
const SearchSelect = ({
  label, value, options, onChange, placeholder = "Select…", error, searchPlaceholder = "Search…",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    : options;

  return (
    <div>
      <label className="text-xs text-muted-foreground font-semibold mb-1.5 block uppercase tracking-wide">
        {label}
      </label>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-2 outline-none flex items-center gap-2 text-left transition-colors",
              error ? "border-destructive/60" : "border-transparent focus:border-primary/40"
            )}
          >
            {selected?.prefix && <span className="text-base leading-none">{selected.prefix}</span>}
            <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown size={16} className="text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[220px]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={14} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No matches</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-left hover:bg-secondary transition-colors"
              >
                {o.prefix && <span className="text-base leading-none">{o.prefix}</span>}
                <span className="flex-1 truncate text-foreground">{o.label}</span>
                {o.hint && <span className="text-xs text-muted-foreground tabular-nums">{o.hint}</span>}
                {o.value === value && <Check size={14} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[11px] text-destructive mt-1.5 font-medium">{error}</p>}
    </div>
  );
};

export default SearchSelect;
