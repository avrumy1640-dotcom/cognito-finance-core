// Canonical fees, timing and limits for Glass Bank money movement.
// Centralised so review screens, limits screens and reports stay in sync.

export type TransferKind = "internal" | "send" | "external" | "wire" | "bill" | "deposit";

export interface FeeTiming {
  feeCents: number;
  feeLabel: string;
  timing: string;
  eta: string;
  cutoff?: string;
}

export const FEE_TIMING: Record<TransferKind, FeeTiming> = {
  internal: { feeCents: 0, feeLabel: "Free", timing: "Instant", eta: "Available immediately" },
  send:     { feeCents: 0, feeLabel: "Free", timing: "Instant", eta: "Usually within seconds" },
  external: { feeCents: 0, feeLabel: "Free", timing: "1–3 business days", eta: "ACH standard", cutoff: "Cut-off 5:00 PM ET" },
  wire:     { feeCents: 2500, feeLabel: "$25.00", timing: "Same-day if sent before 4:00 PM ET", eta: "Domestic wire", cutoff: "Cut-off 4:00 PM ET" },
  bill:     { feeCents: 0, feeLabel: "Free", timing: "1–2 business days", eta: "Delivered by biller" },
  deposit:  { feeCents: 0, feeLabel: "Free", timing: "Next business day", eta: "Funds available after review" },
};

export interface Limit {
  key: string;
  label: string;
  cap: number;
  window: "daily" | "monthly";
  scope: TransferKind[] | "all";
  unit?: "usd" | "count";
}

export const LIMITS: Limit[] = [
  { key: "daily_ach",        label: "Daily ACH transfer",        cap: 25_000,  window: "daily",   scope: ["external"] },
  { key: "daily_card",       label: "Daily card spend",          cap: 10_000,  window: "daily",   scope: "all" },
  { key: "daily_atm",        label: "Daily ATM withdrawal",      cap: 1_000,   window: "daily",   scope: "all" },
  { key: "daily_wire",       label: "Daily wire transfer",       cap: 100_000, window: "daily",   scope: ["wire"] },
  { key: "daily_send",       label: "Daily person-to-person",    cap: 5_000,   window: "daily",   scope: ["send"] },
  { key: "daily_bill",       label: "Daily bill pay",            cap: 15_000,  window: "daily",   scope: ["bill"] },
  { key: "monthly_deposit",  label: "Monthly check deposit",     cap: 25_000,  window: "monthly", scope: ["deposit"] },
];

export const limitsForKind = (kind: TransferKind) =>
  LIMITS.filter((l) => l.scope === "all" || l.scope.includes(kind));

export const formatUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export interface LimitCheckResult {
  ok: boolean;
  breached?: Limit;
  reason?: string;
  chips: { label: string; used: number; cap: number; pct: number }[];
}

/**
 * Given an amount and a rough per-kind usage snapshot, return whether the
 * transaction fits within limits and a chip list to render in review.
 */
export const checkLimits = (
  kind: TransferKind,
  amount: number,
  usage: Partial<Record<string, number>> = {}
): LimitCheckResult => {
  const scoped = limitsForKind(kind);
  const chips = scoped.map((l) => {
    const used = usage[l.key] ?? 0;
    const projected = used + amount;
    return { label: l.label, used: projected, cap: l.cap, pct: Math.min(100, (projected / l.cap) * 100) };
  });
  const breached = scoped.find((l) => (usage[l.key] ?? 0) + amount > l.cap);
  if (breached) {
    return {
      ok: false,
      breached,
      reason: `Exceeds ${breached.label.toLowerCase()} of ${formatUsd(breached.cap)}.`,
      chips,
    };
  }
  return { ok: true, chips };
};
