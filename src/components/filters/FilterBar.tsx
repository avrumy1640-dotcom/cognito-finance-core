import { useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

/**
 * Shared list-filter chrome. Every list view in the app gets the same
 * affordances: a visible search box, a row of quick chips, and an expandable
 * drawer for the precise filters (dates, amounts, status).
 */
export const FilterShell = ({
  search,
  onSearch,
  placeholder = "Search…",
  activeCount,
  onClear,
  children,
  chips,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  activeCount: number;
  onClear: () => void;
  children?: ReactNode;
  chips?: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border-0 bg-secondary py-2.5 pl-9 pr-9 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {children && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors ${
              open || activeCount > 0
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-background/25 px-1.5 text-[11px] font-semibold tabular-nums">
                {activeCount}
              </span>
            )}
          </button>
        )}
      </div>

      {chips && <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5">{chips}</div>}

      {open && children && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-4">
          {children}
          <div className="flex justify-end">
            <button
              onClick={onClear}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Reset all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const FilterChip = ({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
    }`}
  >
    {label}
    {count !== undefined && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
  </button>
);

export const FilterField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    {children}
  </div>
);

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary";

export const DateRangeField = ({
  label = "Date range",
  from,
  to,
  onFrom,
  onTo,
}: {
  label?: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) => (
  <FilterField label={label}>
    <div className="grid grid-cols-2 gap-2">
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} aria-label={`${label} from`} className={inputClass} />
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)} aria-label={`${label} to`} className={inputClass} />
    </div>
  </FilterField>
);

export const AmountRangeField = ({
  min,
  max,
  onMin,
  onMax,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) => (
  <FilterField label="Amount ($)">
    <div className="grid grid-cols-2 gap-2">
      <input inputMode="decimal" value={min} onChange={(e) => onMin(e.target.value)} placeholder="Min" aria-label="Minimum amount" className={inputClass} />
      <input inputMode="decimal" value={max} onChange={(e) => onMax(e.target.value)} placeholder="Max" aria-label="Maximum amount" className={inputClass} />
    </div>
  </FilterField>
);

export const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <FilterField label={label}>
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={inputClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </FilterField>
);

/** Inclusive date-window test that tolerates missing bounds and bad input. */
export function inDateWindow(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

/** Inclusive amount-window test on an absolute value. */
export function inAmountWindow(value: number, min: string, max: string): boolean {
  const lo = min.trim() === "" ? null : Number(min);
  const hi = max.trim() === "" ? null : Number(max);
  const v = Math.abs(value);
  if (lo !== null && Number.isFinite(lo) && v < lo) return false;
  if (hi !== null && Number.isFinite(hi) && v > hi) return false;
  return true;
}
