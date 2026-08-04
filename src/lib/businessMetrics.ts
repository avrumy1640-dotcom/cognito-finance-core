// Cash-flow maths for the business dashboard.
//
// Everything here is derived from transactions the banking partner actually
// reported — nothing is projected, smoothed or invented. When there isn't
// enough history to answer a question honestly, the helpers return `null` so
// the UI can render "—" instead of a confident-looking fake number.
import { categorize } from "@/lib/categorize";

export interface FlowTx {
  id: string;
  merchant: string;
  category: string;
  amount: number; // negative = money out
  date: string;
  status: string;
}

export interface MonthFlow {
  /** "2026-03" */
  key: string;
  /** "Mar" */
  label: string;
  in: number;
  out: number;
  net: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** The last `count` calendar months, oldest first, including the current one. */
export function monthWindow(count = 6, now = new Date()): MonthFlow[] {
  const out: MonthFlow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: monthKey(d),
      label: d.toLocaleString("en-US", { month: "short" }),
      in: 0,
      out: 0,
      net: 0,
    });
  }
  return out;
}

/** Buckets real transactions into the trailing month window. */
export function monthlyFlow(txs: FlowTx[], count = 6, now = new Date()): MonthFlow[] {
  const months = monthWindow(count, now);
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const t of txs) {
    // Failed / returned money never actually moved.
    if (t.status === "failed" || t.status === "returned" || t.status === "canceled") continue;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) continue;
    const m = byKey.get(monthKey(d));
    if (!m) continue;
    if (t.amount >= 0) m.in += t.amount;
    else m.out += Math.abs(t.amount);
  }
  for (const m of months) m.net = m.in - m.out;
  return months;
}

export interface CashFlowSummary {
  months: MonthFlow[];
  thisMonth: MonthFlow;
  /** Average monthly net across COMPLETE months only (current month excluded). */
  avgNet: number | null;
  /** Positive number of dollars burned per month, or null when not burning. */
  burn: number | null;
  /** Months of runway at the current burn, or null when it can't be computed. */
  runwayMonths: number | null;
  /** Complete months of history we actually have data for. */
  historyMonths: number;
}

/**
 * Runway is only shown when we have at least two complete months of history
 * AND the business is genuinely net-negative over them. Anything else returns
 * null so the screen shows "—".
 */
export function cashFlowSummary(txs: FlowTx[], totalBalance: number, now = new Date()): CashFlowSummary {
  const months = monthlyFlow(txs, 6, now);
  const thisMonth = months[months.length - 1];
  const complete = months.slice(0, -1).filter((m) => m.in > 0 || m.out > 0);

  const avgNet = complete.length
    ? complete.reduce((s, m) => s + m.net, 0) / complete.length
    : null;

  const enough = complete.length >= 2;
  const burn = enough && avgNet !== null && avgNet < 0 ? Math.abs(avgNet) : null;
  const runwayMonths = burn && burn > 0 && totalBalance > 0 ? totalBalance / burn : null;

  return { months, thisMonth, avgNet, burn, runwayMonths, historyMonths: complete.length };
}

export interface CategoryTotal {
  category: string;
  total: number;
}

/** Top outgoing categories for the current calendar month. */
export function topCategoriesThisMonth(txs: FlowTx[], limit = 5, now = new Date()): CategoryTotal[] {
  const key = monthKey(now);
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    if (t.status === "failed" || t.status === "returned" || t.status === "canceled") continue;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime()) || monthKey(d) !== key) continue;
    const cat = t.category || categorize(t.merchant, "debit").category;
    totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(t.amount));
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
