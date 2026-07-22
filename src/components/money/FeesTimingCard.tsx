import { Clock, DollarSign, ShieldCheck, AlertTriangle } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";
import { FEE_TIMING, TransferKind, LimitCheckResult, formatUsd } from "@/lib/txPolicy";

export const FeesTimingCard = ({ kind, amount }: { kind: TransferKind; amount: number }) => {
  const info = FEE_TIMING[kind];
  const totalCents = Math.round(amount * 100) + info.feeCents;
  return (
    <GlassCard className="space-y-2.5">
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className="text-primary" />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Fees & timing</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground flex items-center gap-1.5"><DollarSign size={14} />Fee</span>
        <span className="text-sm font-semibold text-foreground">{info.feeLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock size={14} />Timing</span>
        <span className="text-sm font-semibold text-foreground text-right">{info.timing}</span>
      </div>
      {info.cutoff && (
        <p className="text-[11px] text-muted-foreground pt-0.5">{info.cutoff}</p>
      )}
      {info.feeCents > 0 && amount > 0 && (
        <div className="flex items-center justify-between pt-1.5 border-t border-border">
          <span className="text-xs text-muted-foreground">Total debit</span>
          <span className="text-sm font-bold text-foreground">{formatUsd(totalCents / 100)}</span>
        </div>
      )}
    </GlassCard>
  );
};

export const LimitsCheckPanel = ({ check }: { check: LimitCheckResult }) => (
  <GlassCard className="space-y-2.5">
    <div className="flex items-center gap-2">
      {check.ok ? (
        <ShieldCheck size={14} className="text-success" />
      ) : (
        <AlertTriangle size={14} className="text-destructive" />
      )}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Limits check</p>
    </div>
    {!check.ok && (
      <p className="text-xs text-destructive">{check.reason}</p>
    )}
    <div className="space-y-2">
      {check.chips.map((c) => (
        <div key={c.label}>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>{c.label}</span>
            <span>{formatUsd(c.used)} of {formatUsd(c.cap)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full ${c.pct >= 100 ? "bg-destructive" : c.pct >= 80 ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${Math.min(100, c.pct)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </GlassCard>
);
