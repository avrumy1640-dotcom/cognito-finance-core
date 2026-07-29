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

// Honest timing copy. These reflect how the banking partner actually behaves:
// ACH is a batch network (not instant), outgoing debits stay pending until the
// settlement window closes, and wires are business-hours only.
export const FEE_TIMING: Record<TransferKind, FeeTiming> = {
  internal: { feeCents: 0, feeLabel: "Free", timing: "Instant between your accounts", eta: "Available immediately" },
  send:     { feeCents: 0, feeLabel: "Free", timing: "Not available", eta: "Use a bank transfer or wire instead" },
  external: {
    feeCents: 0, feeLabel: "Free",
    timing: "1–3 business days (ACH)",
    eta: "Standard ACH · PPD consumer entry",
    cutoff: "Submitted in the next batch; cut-off 5:00 PM ET on business days. The money stays pending in your balance until it settles — usually two business days.",
  },
  wire:     {
    feeCents: 2500, feeLabel: "$25.00",
    timing: "Same business day if sent before 4:00 PM ET",
    eta: "Domestic wire",
    cutoff: "Wires are processed on business days only — no weekends or bank holidays. Final cut-off is 6:45 PM ET; after that it sends the next business day.",
  },
  bill:     { feeCents: 0, feeLabel: "Free", timing: "1–3 business days (ACH)", eta: "Delivered by the biller's bank", cutoff: "Sent as a standard ACH credit; allow up to three business days." },
  deposit:  { feeCents: 0, feeLabel: "Free", timing: "1–3 business days (ACH pull)", eta: "Funds clear once the debit settles", cutoff: "Incoming ACH debits can be returned by the sending bank for up to two business days." },
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
