import { motion } from "framer-motion";

interface StepProgressProps {
  /** Zero-based index of the current step. */
  index: number;
  total: number;
  /** Short label for the current step, e.g. "Personal details". */
  label?: string;
  /** Optional word used in the counter — defaults to "Step". */
  noun?: string;
  className?: string;
}

/**
 * Shared onboarding / KYC progress indicator: a segmented bar plus an explicit
 * "Step 3 of 10" counter so people always know how much is left.
 */
const StepProgress = ({ index, total, label, noun = "Step", className = "" }: StepProgressProps) => {
  const safeTotal = Math.max(1, total);
  const current = Math.min(Math.max(index, 0), safeTotal - 1);
  const pct = Math.round(((current + 1) / safeTotal) * 100);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="text-[11px] font-semibold text-foreground truncate">
          {noun} {current + 1} of {safeTotal}
          {label ? <span className="text-muted-foreground font-medium"> · {label}</span> : null}
        </p>
        <p className="text-[11px] font-semibold text-muted-foreground shrink-0" aria-hidden>
          {pct}%
        </p>
      </div>
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-label={`${noun} ${current + 1} of ${safeTotal}`}
      >
        {Array.from({ length: safeTotal }).map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full gradient-hero"
              initial={false}
              animate={{ width: i <= current ? "100%" : "0%" }}
              transition={{ duration: 0.28 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepProgress;
