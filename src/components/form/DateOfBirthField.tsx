import { useEffect, useRef, useState, KeyboardEvent, ChangeEvent } from "react";

/* ============================================================================
 * Manual MM/DD/YYYY date-of-birth input with auto-inserted slashes.
 * Emits an ISO `yyyy-mm-dd` string (or "" while incomplete/invalid) so every
 * downstream consumer — profiles row and Column `/entities/person` — keeps the
 * canonical format regardless of the display format.
 * ========================================================================== */

const MIN_AGE = 18;
const MAX_AGE = 120;

export const isoFromMdy = (mdy: string): string => {
  const d = mdy.replace(/\D/g, "");
  if (d.length !== 8) return "";
  const mm = d.slice(0, 2), dd = d.slice(2, 4), yyyy = d.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
};

export const mdyFromIso = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
};

const formatMdy = (digits: string) => {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const daysInMonth = (month: number, year: number) =>
  new Date(year, month, 0).getDate();

/** Returns an error message for a MM/DD/YYYY string, or null when valid. */
export const validateMdy = (mdy: string): string | null => {
  const d = mdy.replace(/\D/g, "");
  if (!d) return null; // empty: no inline error, Continue stays disabled
  const mm = Number(d.slice(0, 2));
  if (d.length >= 2 && (mm < 1 || mm > 12)) return "Month must be between 01 and 12.";
  if (d.length < 8) return "Enter your full date of birth as MM/DD/YYYY.";
  const dd = Number(d.slice(2, 4));
  const yyyy = Number(d.slice(4, 8));
  if (yyyy < 1900) return "Enter a valid year.";
  if (dd < 1 || dd > daysInMonth(mm, yyyy)) {
    return `Day must be between 01 and ${String(daysInMonth(mm, yyyy)).padStart(2, "0")} for that month.`;
  }
  const dob = new Date(yyyy, mm - 1, dd);
  const now = new Date();
  if (dob.getTime() > now.getTime()) return "Date of birth can't be in the future.";
  let age = now.getFullYear() - yyyy;
  const beforeBirthday =
    now.getMonth() + 1 < mm || (now.getMonth() + 1 === mm && now.getDate() < dd);
  if (beforeBirthday) age -= 1;
  if (age < MIN_AGE) return `You must be at least ${MIN_AGE} years old to open an account.`;
  if (age > MAX_AGE) return "Enter a valid date of birth.";
  return null;
};

interface Props {
  /** ISO yyyy-mm-dd (or ""). */
  value: string;
  /** Emits ISO yyyy-mm-dd when complete + valid, otherwise "". */
  onChange: (iso: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}

const DateOfBirthField = ({ value, onChange, onEnter, autoFocus = true }: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => mdyFromIso(value));
  const [touched, setTouched] = useState(false);

  // Re-hydrate from an externally supplied ISO value (draft resume).
  useEffect(() => {
    const incoming = mdyFromIso(value);
    if (incoming && incoming !== text && isoFromMdy(text) !== value) setText(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const commit = (next: string) => {
    setText(next);
    const iso = isoFromMdy(next);
    onChange(iso && !validateMdy(next) ? iso : "");
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let digits = raw.replace(/\D/g, "");
    // Deleting a slash should also delete the digit in front of it, so
    // backspacing never gets stuck on an auto-inserted separator.
    if (raw.length < text.length && /\/$/.test(text) && digits.length === text.replace(/\D/g, "").length) {
      digits = digits.slice(0, -1);
    }
    commit(formatMdy(digits));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setTouched(true);
      onEnter?.();
    }
  };

  const error = touched || text.replace(/\D/g, "").length >= 2 ? validateMdy(text) : null;

  return (
    <div>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        aria-label="Date of birth"
        aria-invalid={!!error}
        value={text}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        onKeyDown={handleKey}
        placeholder="MM/DD/YYYY"
        maxLength={10}
        className={`w-full py-5 px-4 rounded-2xl bg-secondary text-foreground text-lg tabular-nums tracking-wide border-2 outline-none transition-all placeholder:text-muted-foreground/60 ${
          error ? "border-destructive/60" : "border-transparent focus:border-primary/50 focus:bg-card"
        }`}
      />
      {error ? (
        <p className="text-xs text-destructive mt-2 font-medium">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground mt-2">Format: MM/DD/YYYY</p>
      )}
    </div>
  );
};

export default DateOfBirthField;
