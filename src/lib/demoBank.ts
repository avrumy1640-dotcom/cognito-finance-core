// ---------------------------------------------------------------------------
// Local demo banking engine.
//
// The app no longer talks to any external BaaS provider. Everything the UI
// renders — accounts, balances, transaction history, cards, transfers, bill
// pay, deposits — is produced and mutated by this module and persisted in
// localStorage, scoped per signed-in user. It is deterministic per user, so a
// demo session always looks the same on reload, and every money movement is
// reflected instantly in balances and the ledger.
// ---------------------------------------------------------------------------

export type DemoTxStatus = "posted" | "pending";

export interface DemoTransaction {
  id: string;
  merchant: string;
  category: string;
  amount: number; // negative = debit, positive = credit
  date: string; // ISO
  status: DemoTxStatus;
  type: "debit" | "credit";
  paymentMethod: string;
  icon: string;
  account: string; // account id
}

export interface DemoAccount {
  id: string;
  name: string;
  type: "checking" | "savings";
  accountNumber: string;
  routingNumber: string;
  availableBalance: number;
  currentBalance: number;
  pendingAmount: number;
  status: string;
  openedDate: string;
  apy?: number;
  interestEarned?: number;
  depositDetails: {
    accountNumber: string;
    iban: string;
    holderName: string;
    currency: string;
    reference: string;
  };
}

export interface DemoCard {
  id: string;
  nickname: string;
  last4: string;
  network: string;
  type: "virtual" | "physical";
  status: "active" | "locked" | "replaced" | "stolen";
  isLocked: boolean;
  isVirtual: boolean;
  expiresAt: string;
  linkedAccount: string;
  controls: {
    international: boolean;
    online: boolean;
    contactless: boolean;
    inStore: boolean;
    atm: boolean;
  };
}

export interface DemoGoalContribution {
  id: string;
  amount: number;
  date: string; // ISO
  source: "manual" | "round-up";
  note?: string;
}

export interface DemoGoal {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  targetDate: string; // ISO date (yyyy-mm-dd)
  saved: number;
  createdAt: string;
  contributions: DemoGoalContribution[];
}

/** An advance of an upcoming payroll deposit, released up to 2 days early. */
export interface DemoEarlyPayout {
  id: string;
  /** ISO date of the payday this advance stands in for. */
  expectedDate: string;
  amount: number;
  releasedAt: string;
  /** Set once the real payday has passed — the deposit is accounted for. */
  settledAt?: string | null;
  merchant: string;
}

export type DisputeReason =
  | "unauthorized"
  | "wrong_amount"
  | "duplicate"
  | "not_received"
  | "other";

export type DisputeStatus = "submitted" | "under_review" | "resolved";

/** A single, uploaded piece of supporting evidence (metadata only). */
export interface DisputeEvidence {
  name: string;
  size: number;
  type: string;
}

export interface DisputeEvent {
  status: DisputeStatus;
  at: string;
  note: string;
}

export interface DemoDispute {
  id: string;
  caseNumber: string;
  transactionId: string;
  merchant: string;
  amount: number;
  reason: DisputeReason;
  note?: string;
  status: DisputeStatus;
  createdAt: string;
  updatedAt: string;
  resolution?: string | null;
  evidence?: DisputeEvidence[];
  timeline?: DisputeEvent[];
}

export type ReferralStatus = "invited" | "signed_up" | "completed";

export interface DemoReferral {
  id: string;
  name: string;
  contact: string;
  status: ReferralStatus;
  invitedAt: string;
  updatedAt: string;
  /** Set once the $20 bonus has been credited to checking. */
  bonusPaidAt?: string | null;
  bonusAmount: number;
}

export interface DemoCashbackRedemption {
  id: string;
  amount: number;
  date: string;
}

export interface DemoLedger {
  version: 1;
  userNumber: string;
  holderName: string;
  accounts: DemoAccount[];
  transactions: DemoTransaction[];
  cards: DemoCard[];
  /** Savings goals — optional so older persisted ledgers stay valid. */
  goals?: DemoGoal[];
  /** Goal id that receives round-up sweeps, or null when round-ups are off. */
  roundUpGoalId?: string | null;
  /** Ids of debits already swept, so round-ups are never double counted. */
  roundUpSweptTxIds?: string[];
  /** Early paycheck advances already released. */
  earlyPayouts?: DemoEarlyPayout[];
  /** Transaction disputes raised by the customer. */
  disputes?: DemoDispute[];
  /** Referral program. */
  referralCode?: string;
  referrals?: DemoReferral[];
  /** Cashback already paid out to checking. */
  cashbackRedemptions?: DemoCashbackRedemption[];
  /** Whether the customer has opted in to the no-fee overdraft cushion. */
  overdraftOptIn?: boolean;
}



const STORAGE_PREFIX = "glassbank.demo.v1:";
const ROUTING = "084106768";

/** No-fee overdraft cushion available on the checking account. */
export const OVERDRAFT_CUSHION = 200;
/** Cashback rate earned on Glass Card purchases. */
export const CASHBACK_RATE = 0.01;


// ---- deterministic pseudo-random ------------------------------------------
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const MERCHANTS: Array<{ name: string; category: string; icon: string; min: number; max: number }> = [
  { name: "Whole Foods Market", category: "Groceries", icon: "🛒", min: 24, max: 168 },
  { name: "Trader Joe's", category: "Groceries", icon: "🛒", min: 18, max: 96 },
  { name: "Blue Bottle Coffee", category: "Dining", icon: "☕️", min: 5, max: 18 },
  { name: "Sweetgreen", category: "Dining", icon: "🥗", min: 12, max: 29 },
  { name: "Uber", category: "Transport", icon: "🚗", min: 9, max: 62 },
  { name: "Shell", category: "Transport", icon: "⛽️", min: 32, max: 89 },
  { name: "Amazon", category: "Shopping", icon: "📦", min: 14, max: 240 },
  { name: "Apple", category: "Shopping", icon: "", min: 9, max: 129 },
  { name: "Netflix", category: "Subscriptions", icon: "🎬", min: 15.49, max: 15.49 },
  { name: "Spotify", category: "Subscriptions", icon: "🎧", min: 11.99, max: 11.99 },
  { name: "ConEdison", category: "Bills & Utilities", icon: "💡", min: 78, max: 214 },
  { name: "Verizon Wireless", category: "Bills & Utilities", icon: "📱", min: 65, max: 110 },
  { name: "Equinox", category: "Health", icon: "🏋️", min: 185, max: 260 },
  { name: "CVS Pharmacy", category: "Health", icon: "💊", min: 8, max: 74 },
  { name: "Delta Air Lines", category: "Travel", icon: "✈️", min: 148, max: 640 },
  { name: "Marriott Hotels", category: "Travel", icon: "🏨", min: 190, max: 520 },
];

function accountNumberFor(seed: number, offset: number): string {
  const n = (seed % 9000_0000) + 1000_0000 + offset * 137;
  return String(n).padStart(8, "0").slice(0, 8);
}

function isoDaysAgo(days: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ---- ledger generation -----------------------------------------------------

export function generateLedger(userId: string, holderName: string, email?: string): DemoLedger {
  const seed = hashSeed(userId || email || "glass-demo");
  const rng = makeRng(seed);

  const chkNumber = accountNumberFor(seed, 1);
  const savNumber = accountNumberFor(seed, 2);

  const checking: DemoAccount = {
    id: `chk_${chkNumber}`,
    name: "Everyday Checking",
    type: "checking",
    accountNumber: `••••${chkNumber.slice(-4)}`,
    routingNumber: ROUTING,
    availableBalance: 0,
    currentBalance: 0,
    pendingAmount: 0,
    status: "Active",
    openedDate: isoDaysAgo(420),
    depositDetails: {
      accountNumber: chkNumber,
      iban: `US29GLSS${chkNumber}0000`,
      holderName,
      currency: "USD",
      reference: chkNumber,
    },
  };

  const savings: DemoAccount = {
    id: `sav_${savNumber}`,
    name: "High-Yield Savings",
    type: "savings",
    accountNumber: `••••${savNumber.slice(-4)}`,
    routingNumber: ROUTING,
    availableBalance: 0,
    currentBalance: 0,
    pendingAmount: 0,
    status: "Active",
    openedDate: isoDaysAgo(400),
    apy: 4.35,
    interestEarned: round2(180 + rng() * 320),
    depositDetails: {
      accountNumber: savNumber,
      iban: `US29GLSS${savNumber}0000`,
      holderName,
      currency: "USD",
      reference: savNumber,
    },
  };

  const transactions: DemoTransaction[] = [];
  let txSeq = 0;
  const nextId = () => `tx_${seed.toString(36)}_${(txSeq++).toString().padStart(4, "0")}`;

  // Biweekly payroll credits into checking
  for (let d = 88; d >= 0; d -= 14) {
    transactions.push({
      id: nextId(),
      merchant: "Norven Health Payroll",
      category: "Income",
      amount: round2(4180 + rng() * 260),
      date: isoDaysAgo(d, 9, 12),
      status: "posted",
      type: "credit",
      paymentMethod: "Direct deposit",
      icon: "💰",
      account: checking.id,
    });
  }

  // Monthly rent
  for (let m = 2; m >= 0; m--) {
    transactions.push({
      id: nextId(),
      merchant: "Hudson Yards Residences",
      category: "Housing",
      amount: -2450,
      date: isoDaysAgo(m * 30 + 2, 8, 5),
      status: "posted",
      type: "debit",
      paymentMethod: "Bill pay",
      icon: "🏠",
      account: checking.id,
    });
  }

  // Everyday card spend
  for (let d = 89; d >= 0; d--) {
    const count = rng() < 0.55 ? 1 : rng() < 0.8 ? 2 : 0;
    for (let i = 0; i < count; i++) {
      const m = MERCHANTS[Math.floor(rng() * MERCHANTS.length)];
      const amt = round2(m.min + rng() * (m.max - m.min));
      transactions.push({
        id: nextId(),
        merchant: m.name,
        category: m.category,
        amount: -amt,
        date: isoDaysAgo(d, 8 + Math.floor(rng() * 12), Math.floor(rng() * 59)),
        status: d <= 1 && rng() < 0.5 ? "pending" : "posted",
        type: "debit",
        paymentMethod: "Glass Card",
        icon: m.icon,
        account: checking.id,
      });
    }
  }

  // Monthly savings sweeps
  for (let m = 2; m >= 0; m--) {
    const amt = round2(600 + rng() * 400);
    transactions.push({
      id: nextId(),
      merchant: "Transfer to High-Yield Savings",
      category: "Transfers",
      amount: -amt,
      date: isoDaysAgo(m * 30 + 5, 10, 30),
      status: "posted",
      type: "debit",
      paymentMethod: "Internal transfer",
      icon: "🔁",
      account: checking.id,
    });
    transactions.push({
      id: nextId(),
      merchant: "Transfer from Everyday Checking",
      category: "Transfers",
      amount: amt,
      date: isoDaysAgo(m * 30 + 5, 10, 30),
      status: "posted",
      type: "credit",
      paymentMethod: "Internal transfer",
      icon: "🔁",
      account: savings.id,
    });
    transactions.push({
      id: nextId(),
      merchant: "Interest earned",
      category: "Income",
      amount: round2(48 + rng() * 26),
      date: isoDaysAgo(m * 30 + 1, 6, 0),
      status: "posted",
      type: "credit",
      paymentMethod: "Interest",
      icon: "✨",
      account: savings.id,
    });
  }

  transactions.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  // Balances: start from an opening balance and apply the ledger.
  const sum = (id: string) => transactions.filter((t) => t.account === id).reduce((s, t) => s + t.amount, 0);
  const chkOpening = 4200;
  const savOpening = 18500;
  checking.currentBalance = round2(chkOpening + sum(checking.id));
  checking.pendingAmount = round2(
    Math.abs(transactions.filter((t) => t.account === checking.id && t.status === "pending").reduce((s, t) => s + t.amount, 0)),
  );
  checking.availableBalance = round2(checking.currentBalance - checking.pendingAmount);
  savings.currentBalance = round2(savOpening + sum(savings.id));
  savings.availableBalance = savings.currentBalance;

  const expMonth = String(((seed % 12) + 1)).padStart(2, "0");
  const expYear = String(29 + (seed % 2));

  const card: DemoCard = {
    id: `card_${seed.toString(36)}`,
    nickname: "Glass Card",
    last4: String(1000 + (seed % 9000)),
    network: "Visa",
    type: "virtual",
    status: "active",
    isLocked: false,
    isVirtual: true,
    expiresAt: `${expMonth}/${expYear}`,
    linkedAccount: checking.name,
    controls: { international: true, online: true, contactless: true, inStore: true, atm: true },
  };

  return {
    version: 1,
    userNumber: `GB${String(seed).slice(0, 8)}`,
    holderName,
    accounts: [checking, savings],
    transactions,
    cards: [card],
  };
}

// ---- persistence -----------------------------------------------------------

function keyFor(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function read(userId: string): DemoLedger | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoLedger;
    if (parsed?.version !== 1 || !Array.isArray(parsed.accounts)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(userId: string, ledger: DemoLedger) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(ledger));
  } catch {
    /* storage full / private mode — the in-memory copy still works */
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- payroll detection (early paycheck access) -----------------------------

export interface PayrollPattern {
  merchant: string;
  /** Average of the recent payroll deposits — what an advance would release. */
  averageAmount: number;
  intervalDays: number;
  lastPaidAt: string;
  nextExpectedAt: string;
  daysUntilNext: number;
  /** True when the next payday is within the 2-day early-access window. */
  eligibleNow: boolean;
  /** Already advanced for this upcoming payday. */
  alreadyAdvanced: boolean;
  occurrences: number;
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Look for a recurring direct-deposit credit (same payer, regular cadence) and
 * project the next payday from it. Returns null when there isn't enough
 * history to be honest about a prediction.
 */
export function detectPayroll(ledger: DemoLedger): PayrollPattern | null {
  const checking = ledger.accounts.find((a) => a.type === "checking");
  if (!checking) return null;

  const groups = new Map<string, DemoTransaction[]>();
  for (const t of ledger.transactions) {
    if (t.account !== checking.id || t.amount <= 0) continue;
    const isPayroll = t.paymentMethod === "Direct deposit" || /payroll|salary/i.test(t.merchant);
    if (!isPayroll) continue;
    const list = groups.get(t.merchant) ?? [];
    list.push(t);
    groups.set(t.merchant, list);
  }

  let best: { merchant: string; txs: DemoTransaction[] } | null = null;
  for (const [merchant, txs] of groups) {
    if (txs.length < 3) continue;
    if (!best || txs.length > best.txs.length) best = { merchant, txs };
  }
  if (!best) return null;

  const sorted = best.txs.slice().sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.round((+new Date(sorted[i].date) - +new Date(sorted[i - 1].date)) / DAY));
  }
  gaps.sort((a, b) => a - b);
  const intervalDays = gaps[Math.floor(gaps.length / 2)] || 14;
  if (intervalDays < 5 || intervalDays > 40) return null;

  const last = sorted[sorted.length - 1];
  const recent = sorted.slice(-3);
  const averageAmount = round2(recent.reduce((s, t) => s + t.amount, 0) / recent.length);

  // Roll forward from the last deposit until the projected payday is in the future.
  const next = new Date(last.date);
  const today = startOfDay(new Date());
  let guard = 0;
  while (startOfDay(next) <= today && guard++ < 60) {
    next.setDate(next.getDate() + intervalDays);
  }
  const daysUntilNext = Math.max(0, Math.round((startOfDay(next) - today) / DAY));
  const expectedKey = next.toISOString().slice(0, 10);
  const alreadyAdvanced = (ledger.earlyPayouts ?? []).some(
    (p) => p.expectedDate.slice(0, 10) === expectedKey,
  );

  return {
    merchant: best.merchant,
    averageAmount,
    intervalDays,
    lastPaidAt: last.date,
    nextExpectedAt: next.toISOString(),
    daysUntilNext,
    eligibleNow: daysUntilNext <= 2 && !alreadyAdvanced,
    alreadyAdvanced,
    occurrences: sorted.length,
  };
}

const REASON_LABELS: Record<DisputeReason, string> = {
  unauthorized: "Unauthorized charge",
  wrong_amount: "Wrong amount",
  duplicate: "Duplicate charge",
  not_received: "Goods or services not received",
  other: "Other",
};

export const disputeReasonLabel = (r: DisputeReason) => REASON_LABELS[r] ?? "Other";

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  resolved: "Resolved",
};

/** Move disputes along their lifecycle: submitted → under review → resolved. */
function progressDisputes(ledger: DemoLedger): boolean {
  let changed = false;
  for (const d of ledger.disputes ?? []) {
    d.timeline = d.timeline ?? [
      { status: "submitted", at: d.createdAt, note: "Dispute submitted and case opened." },
    ];
    const age = Date.now() - +new Date(d.createdAt);
    if (d.status === "submitted") {
      if (age < 6 * 60 * 60 * 1000) continue;
      d.status = "under_review";
      d.updatedAt = new Date().toISOString();
      d.timeline.push({
        status: "under_review",
        at: d.updatedAt,
        note: "Our disputes team is reviewing the charge with the merchant.",
      });
      changed = true;
      continue;
    }
    if (d.status !== "under_review") continue;
    if (age < 3 * DAY) continue;
    d.status = "resolved";
    d.updatedAt = new Date().toISOString();
    d.resolution =
      d.reason === "unauthorized"
        ? "Provisional credit issued and the charge was reversed."
        : "Reviewed with the merchant — the charge was confirmed as valid.";
    d.timeline.push({ status: "resolved", at: d.updatedAt, note: d.resolution });
    changed = true;
  }
  return changed;
}

/** Mark early payouts as settled once their real payday has passed. */
function settleEarlyPayouts(ledger: DemoLedger): boolean {
  let changed = false;
  for (const p of ledger.earlyPayouts ?? []) {
    if (p.settledAt) continue;
    if (+new Date(p.expectedDate) > Date.now()) continue;
    p.settledAt = new Date().toISOString();
    changed = true;
  }
  return changed;
}

// ---- overdraft cushion -----------------------------------------------------

/** Opt-in state for the cushion. Defaults to on for existing ledgers. */
export function overdraftEnabled(ledger: DemoLedger | null | undefined): boolean {
  return ledger?.overdraftOptIn !== false;
}

/** Cushion only applies to the everyday checking account, and only when opted in. */
export function cushionLimitFor(account: DemoAccount | null | undefined, enabled = true): number {
  return enabled && account?.type === "checking" ? OVERDRAFT_CUSHION : 0;
}

/** How much of the cushion is currently drawn (0 when the balance is positive). */
export function cushionUsed(account: DemoAccount | null | undefined, enabled = true): number {
  if (!account || account.type !== "checking") return 0;
  return round2(Math.min(cushionLimitFor(account, enabled), Math.max(0, -account.availableBalance)));
}

/**
 * What the customer can actually spend: their available balance plus whatever
 * remains of the no-fee cushion. Never below zero.
 */
export function spendableBalance(account: DemoAccount | null | undefined, enabled = true): number {
  if (!account) return 0;
  return round2(
    Math.max(0, account.availableBalance + (cushionLimitFor(account, enabled) - cushionUsed(account, enabled))),
  );
}

// ---- referrals -------------------------------------------------------------

const REFERRAL_BONUS = 20;

function makeReferralCode(seed: number, holderName: string): string {
  const initials = holderName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "GB";
  return `${initials}${(seed % 100000).toString().padStart(5, "0")}`;
}

export function referralLinkFor(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://glassbank.app";
  return `${origin}/signup?ref=${code}`;
}

const SAMPLE_REFERRALS: Array<{ name: string; contact: string; status: ReferralStatus; daysAgo: number }> = [
  { name: "Maya Rodriguez", contact: "maya.r@email.com", status: "completed", daysAgo: 26 },
  { name: "Devin Clarke", contact: "(917) 555-0142", status: "signed_up", daysAgo: 11 },
  { name: "Priya Anand", contact: "priya.anand@email.com", status: "invited", daysAgo: 3 },
];

/** Seed the referral program once, and credit bonuses for completed referrals. */
function ensureReferrals(ledger: DemoLedger): boolean {
  let changed = false;
  if (!ledger.referralCode) {
    ledger.referralCode = makeReferralCode(hashSeed(ledger.userNumber), ledger.holderName);
    changed = true;
  }
  if (!ledger.referrals) {
    ledger.referrals = SAMPLE_REFERRALS.map((s, i) => ({
      id: `ref_seed_${i}`,
      name: s.name,
      contact: s.contact,
      status: s.status,
      invitedAt: isoDaysAgo(s.daysAgo, 10, 15),
      updatedAt: isoDaysAgo(Math.max(0, s.daysAgo - 4), 10, 15),
      bonusPaidAt: null,
      bonusAmount: REFERRAL_BONUS,
    }));
    changed = true;
  }
  // Pay out any completed referral that hasn't been credited yet.
  const checking = ledger.accounts.find((a) => a.type === "checking");
  if (checking) {
    for (const r of ledger.referrals) {
      if (r.status !== "completed" || r.bonusPaidAt) continue;
      const date = r.updatedAt || new Date().toISOString();
      r.bonusPaidAt = date;
      ledger.transactions.unshift({
        id: `tx_referral_${r.id}`,
        merchant: `Referral bonus — ${r.name}`,
        category: "Rewards",
        amount: r.bonusAmount,
        date,
        status: "posted",
        type: "credit",
        paymentMethod: "Referral bonus",
        icon: "🎁",
        account: checking.id,
      });
      checking.currentBalance = round2(checking.currentBalance + r.bonusAmount);
      checking.availableBalance = round2(checking.currentBalance - checking.pendingAmount);
      changed = true;
    }
  }
  if (changed) {
    ledger.transactions.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }
  return changed;
}

export const referralStatusLabel: Record<ReferralStatus, string> = {
  invited: "Invited",
  signed_up: "Signed up",
  completed: "Completed",
};

// ---- cashback rewards ------------------------------------------------------

export interface CashbackSummary {
  rate: number;
  allTimeEarned: number;
  thisMonthEarned: number;
  redeemed: number;
  available: number;
  entries: Array<{ id: string; merchant: string; date: string; spend: number; earned: number }>;
}

const isCardPurchase = (t: DemoTransaction) =>
  t.amount < 0 && /card/i.test(t.paymentMethod) && t.category !== "Transfers" && t.category !== "Fees";

export function cashbackSummary(ledger: DemoLedger): CashbackSummary {
  const entries = ledger.transactions
    .filter(isCardPurchase)
    .map((t) => ({
      id: t.id,
      merchant: t.merchant,
      date: t.date,
      spend: round2(Math.abs(t.amount)),
      earned: round2(Math.abs(t.amount) * CASHBACK_RATE),
    }));
  const allTimeEarned = round2(entries.reduce((s, e) => s + e.earned, 0));
  const now = new Date();
  const thisMonthEarned = round2(
    entries
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, e) => s + e.earned, 0),
  );
  const redeemed = round2((ledger.cashbackRedemptions ?? []).reduce((s, r) => s + r.amount, 0));
  return {
    rate: CASHBACK_RATE,
    allTimeEarned,
    thisMonthEarned,
    redeemed,
    available: round2(Math.max(0, allTimeEarned - redeemed)),
    entries,
  };
}

// ---- credit building -------------------------------------------------------

export type CreditFactorStatus = "excellent" | "good" | "fair" | "poor";

export interface CreditFactor {
  key: string;
  label: string;
  status: CreditFactorStatus;
  detail: string;
  impact: "High" | "Medium" | "Low";
}

export interface CreditProfile {
  score: number;
  band: string;
  delta: number;
  history: Array<{ month: string; score: number }>;
  factors: CreditFactor[];
  utilization: number;
  onTimePayments: number;
  accountAgeMonths: number;
}

function scoreBand(score: number): string {
  if (score >= 800) return "Exceptional";
  if (score >= 740) return "Very good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Needs work";
}

export function creditProfile(ledger: DemoLedger): CreditProfile {
  const seed = hashSeed(`credit:${ledger.userNumber}`);
  const rng = makeRng(seed);
  const checking = ledger.accounts.find((a) => a.type === "checking");

  const opened = checking ? new Date(checking.openedDate) : new Date();
  const accountAgeMonths = Math.max(
    1,
    Math.round((Date.now() - opened.getTime()) / (30.44 * DAY)),
  );

  // Utilization proxy: monthly card spend against a $2,000 secured-style line.
  const cutoff = Date.now() - 30 * DAY;
  const monthSpend = ledger.transactions
    .filter((t) => isCardPurchase(t) && +new Date(t.date) >= cutoff)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const utilization = Math.min(99, Math.round((monthSpend / 2000) * 100));

  // Payments are on time unless a bill-pay debit was declined (none in the
  // demo ledger), so this reflects the customer's real bill-pay volume.
  const billPayments = ledger.transactions.filter((t) => t.paymentMethod === "Bill pay").length;
  const onTimePayments = billPayments;

  const base = 650 + Math.floor(rng() * 30); // 650–679 starting band
  const utilPenalty = utilization > 30 ? Math.min(25, Math.round((utilization - 30) * 0.6)) : 0;
  const agingBonus = Math.min(24, Math.round(accountAgeMonths * 1.2));
  const payingBonus = Math.min(18, billPayments * 3);
  const score = Math.max(520, Math.min(850, base + agingBonus + payingBonus - utilPenalty));

  // 12 months of history walking up to today's score.
  const history: Array<{ month: string; score: number }> = [];
  let running = Math.max(500, score - 34);
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const step = i === 0 ? score - running : Math.round(rng() * 8) - 2;
    running = Math.max(500, Math.min(850, running + step));
    history.push({
      month: d.toLocaleDateString("en-US", { month: "short" }),
      score: i === 0 ? score : running,
    });
  }
  const delta = score - history[0].score;

  const utilStatus: CreditFactorStatus =
    utilization <= 10 ? "excellent" : utilization <= 30 ? "good" : utilization <= 50 ? "fair" : "poor";
  const ageStatus: CreditFactorStatus =
    accountAgeMonths >= 60 ? "excellent" : accountAgeMonths >= 24 ? "good" : accountAgeMonths >= 12 ? "fair" : "poor";

  const factors: CreditFactor[] = [
    {
      key: "payment_history",
      label: "Payment history",
      status: "excellent",
      detail: `${onTimePayments} of ${onTimePayments} payments made on time`,
      impact: "High",
    },
    {
      key: "utilization",
      label: "Credit utilization",
      status: utilStatus,
      detail: `${utilization}% of your $2,000 Glass Card line used this month`,
      impact: "High",
    },
    {
      key: "age",
      label: "Account age",
      status: ageStatus,
      detail: `${accountAgeMonths} month${accountAgeMonths === 1 ? "" : "s"} since you opened Glass Bank`,
      impact: "Medium",
    },
    {
      key: "mix",
      label: "Credit mix",
      status: ledger.accounts.length > 1 ? "good" : "fair",
      detail: `${ledger.accounts.length} deposit account${ledger.accounts.length === 1 ? "" : "s"} + 1 Glass Card`,
      impact: "Low",
    },
  ];

  return { score, band: scoreBand(score), delta, history, factors, utilization, onTimePayments, accountAgeMonths };
}


export const demoBank = {
  /** Load (or lazily create) the user's ledger. Never throws, never fails. */
  async load(userId: string, holderName: string, email?: string): Promise<DemoLedger> {
    await delay(220);
    let ledger = read(userId);
    if (!ledger) {
      ledger = generateLedger(userId, holderName, email);
      write(userId, ledger);
    } else if (holderName && ledger.holderName !== holderName) {
      ledger.holderName = holderName;
      ledger.accounts.forEach((a) => { a.depositDetails.holderName = holderName; });
      write(userId, ledger);
    }
    // Time-based housekeeping: settle matured advances, age out disputes,
    // seed the referral program and pay any earned referral bonuses.
    const housekeeping = [settleEarlyPayouts(ledger), progressDisputes(ledger), ensureReferrals(ledger)];
    if (housekeeping.some(Boolean)) write(userId, ledger);
    return ledger;
  },

  // ---- referrals -----------------------------------------------------------

  /** Record a new invite against the user's referral code. */
  async inviteReferral(userId: string, args: { name: string; contact: string }): Promise<DemoLedger> {
    await delay(320);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    ensureReferrals(ledger);
    const name = args.name.trim();
    const contact = args.contact.trim();
    if (!name) throw new Error("Add a name so you can track this invite");
    const now = new Date().toISOString();
    ledger.referrals = [
      {
        id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        contact,
        status: "invited",
        invitedAt: now,
        updatedAt: now,
        bonusPaidAt: null,
        bonusAmount: REFERRAL_BONUS,
      },
      ...(ledger.referrals ?? []),
    ];
    write(userId, ledger);
    return ledger;
  },

  // ---- overdraft cushion ---------------------------------------------------

  /** Opt in to (or out of) the no-fee overdraft cushion. */
  async setOverdraftOptIn(userId: string, enabled: boolean): Promise<DemoLedger> {
    await delay(240);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    if (!enabled) {
      const checking = ledger.accounts.find((a) => a.type === "checking");
      if (checking && checking.availableBalance < 0) {
        throw new Error("Bring your balance back above $0 before turning the cushion off");
      }
    }
    ledger.overdraftOptIn = enabled;
    write(userId, ledger);
    return ledger;
  },

  // ---- cashback rewards ----------------------------------------------------

  /** Pay the accrued cashback into checking as a real credit. */
  async redeemCashback(userId: string): Promise<{ ledger: DemoLedger; amount: number }> {
    await delay(460);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const summary = cashbackSummary(ledger);
    const amount = round2(summary.available);
    if (amount < 1) throw new Error("You need at least $1.00 in cashback to redeem");
    const checking = ledger.accounts.find((a) => a.type === "checking");
    if (!checking) throw new Error("Checking account unavailable");
    const now = new Date().toISOString();
    ledger.transactions.unshift({
      id: `tx_cashback_${Date.now()}`,
      merchant: "Glass Card cashback",
      category: "Rewards",
      amount,
      date: now,
      status: "posted",
      type: "credit",
      paymentMethod: "Cashback redemption",
      icon: "💚",
      account: checking.id,
    });
    checking.currentBalance = round2(checking.currentBalance + amount);
    checking.availableBalance = round2(checking.currentBalance - checking.pendingAmount);
    ledger.cashbackRedemptions = [
      { id: `cbr_${Date.now()}`, amount, date: now },
      ...(ledger.cashbackRedemptions ?? []),
    ];
    write(userId, ledger);
    return { ledger, amount };
  },


  // ---- early paycheck access ----------------------------------------------

  /** Release the next expected payroll deposit into checking, up to 2 days early. */
  async releaseEarlyPaycheck(userId: string): Promise<DemoLedger> {
    await delay(520);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const pattern = detectPayroll(ledger);
    if (!pattern) throw new Error("No recurring payroll deposit detected yet");
    if (pattern.alreadyAdvanced) throw new Error("This paycheck has already been released early");
    if (pattern.daysUntilNext > 2) throw new Error("Your paycheck is not within the 2-day window yet");

    const checking = ledger.accounts.find((a) => a.type === "checking");
    if (!checking) throw new Error("Checking account unavailable");

    const now = new Date().toISOString();
    const amount = round2(pattern.averageAmount);
    ledger.transactions.unshift({
      id: `tx_early_${Date.now()}`,
      merchant: `${pattern.merchant} (early)`,
      category: "Income",
      amount,
      date: now,
      status: "posted",
      type: "credit",
      paymentMethod: "Early direct deposit",
      icon: "⚡️",
      account: checking.id,
    });
    checking.currentBalance = round2(checking.currentBalance + amount);
    checking.availableBalance = round2(checking.currentBalance - checking.pendingAmount);

    ledger.earlyPayouts = [
      {
        id: `early_${Date.now()}`,
        expectedDate: pattern.nextExpectedAt,
        amount,
        releasedAt: now,
        settledAt: null,
        merchant: pattern.merchant,
      },
      ...(ledger.earlyPayouts ?? []),
    ];
    write(userId, ledger);
    return ledger;
  },

  // ---- disputes ------------------------------------------------------------

  async openDispute(
    userId: string,
    args: {
      transactionId: string;
      merchant: string;
      amount: number;
      reason: DisputeReason;
      note?: string;
      evidence?: DisputeEvidence[];
    },
  ): Promise<{ ledger: DemoLedger; dispute: DemoDispute }> {
    await delay(480);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    ledger.disputes = ledger.disputes ?? [];
    const existing = ledger.disputes.find((d) => d.transactionId === args.transactionId);
    if (existing) throw new Error(`A dispute is already open for this transaction (${existing.caseNumber})`);
    const now = new Date().toISOString();
    const dispute: DemoDispute = {
      id: `dsp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      caseNumber: `GB-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 899999))}`,
      transactionId: args.transactionId,
      merchant: args.merchant,
      amount: round2(Math.abs(args.amount)),
      reason: args.reason,
      note: args.note?.trim() || undefined,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
      resolution: null,
      evidence: args.evidence ?? [],
      timeline: [{ status: "submitted", at: now, note: "Dispute submitted and case opened." }],
    };
    ledger.disputes.unshift(dispute);
    write(userId, ledger);
    return { ledger, dispute };
  },


  reset(userId: string) {
    try { localStorage.removeItem(keyFor(userId)); } catch { /* noop */ }
  },

  /** Post a debit out of an account (external transfer, wire, bill pay, card load-out). */
  async debit(
    userId: string,
    args: { accountId: string; amount: number; merchant: string; category: string; paymentMethod: string; icon?: string; fee?: number; status?: DemoTxStatus },
  ): Promise<DemoLedger> {
    await delay(420);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const acct = ledger.accounts.find((a) => a.id === args.accountId) ?? ledger.accounts[0];
    const now = new Date().toISOString();

    // Overdraft cushion: checking may go up to $50 negative at no fee.
    // Anything past that is declined rather than silently allowed.
    const total = round2(Math.abs(args.amount) + Math.abs(args.fee ?? 0));
    const odEnabled = overdraftEnabled(ledger);
    const cushionBefore = cushionUsed(acct, odEnabled);
    const spendable = spendableBalance(acct, odEnabled);
    if (total > spendable + 0.001) {
      const cushionNote =
        acct.type === "checking" && odEnabled
          ? ` Your balance plus the $${OVERDRAFT_CUSHION} cushion covers ${spendable.toFixed(2)}.`
          : "";
      throw new Error(`Insufficient funds.${cushionNote}`);
    }

    const post = (amount: number, merchant: string, category: string, icon: string) => {
      ledger.transactions.unshift({
        id: `tx_live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        merchant,
        category,
        amount,
        date: now,
        status: args.status ?? "pending",
        type: amount < 0 ? "debit" : "credit",
        paymentMethod: args.paymentMethod,
        icon,
        account: acct.id,
      });
    };
    post(-Math.abs(args.amount), args.merchant, args.category, args.icon ?? "💳");
    if (args.fee && args.fee > 0) post(-Math.abs(args.fee), `${args.merchant} — fee`, "Fees", "🧾");
    acct.currentBalance = round2(acct.currentBalance - total);
    acct.pendingAmount = round2(acct.pendingAmount + ((args.status ?? "pending") === "pending" ? total : 0));
    acct.availableBalance = round2(acct.currentBalance - acct.pendingAmount);
    void cushionBefore; // cushion draw is surfaced from balances, not a fee line
    write(userId, ledger);
    return ledger;

  },

  /** Post a credit into an account (deposits, card loads, incoming transfers). */
  async credit(
    userId: string,
    args: { accountId: string; amount: number; merchant: string; category?: string; paymentMethod: string; icon?: string; status?: DemoTxStatus },
  ): Promise<DemoLedger> {
    await delay(420);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const acct = ledger.accounts.find((a) => a.id === args.accountId) ?? ledger.accounts[0];
    ledger.transactions.unshift({
      id: `tx_live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      merchant: args.merchant,
      category: args.category ?? "Deposits",
      amount: Math.abs(args.amount),
      date: new Date().toISOString(),
      status: args.status ?? "posted",
      type: "credit",
      paymentMethod: args.paymentMethod,
      icon: args.icon ?? "💰",
      account: acct.id,
    });
    acct.currentBalance = round2(acct.currentBalance + Math.abs(args.amount));
    acct.availableBalance = round2(acct.currentBalance - acct.pendingAmount);
    write(userId, ledger);
    return ledger;
  },

  /** Move funds between two of the user's own accounts. */
  async internalTransfer(
    userId: string,
    args: { fromId: string; toId: string; amount: number; memo?: string },
  ): Promise<DemoLedger> {
    await delay(420);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const from = ledger.accounts.find((a) => a.id === args.fromId);
    const to = ledger.accounts.find((a) => a.id === args.toId);
    if (!from || !to) return ledger;
    const now = new Date().toISOString();
    const amt = round2(Math.abs(args.amount));
    ledger.transactions.unshift(
      {
        id: `tx_live_${Date.now()}_out`,
        merchant: `Transfer to ${to.name}`,
        category: "Transfers",
        amount: -amt,
        date: now,
        status: "posted",
        type: "debit",
        paymentMethod: "Internal transfer",
        icon: "🔁",
        account: from.id,
      },
      {
        id: `tx_live_${Date.now()}_in`,
        merchant: `Transfer from ${from.name}`,
        category: "Transfers",
        amount: amt,
        date: now,
        status: "posted",
        type: "credit",
        paymentMethod: "Internal transfer",
        icon: "🔁",
        account: to.id,
      },
    );
    from.currentBalance = round2(from.currentBalance - amt);
    from.availableBalance = round2(from.currentBalance - from.pendingAmount);
    to.currentBalance = round2(to.currentBalance + amt);
    to.availableBalance = round2(to.currentBalance - to.pendingAmount);
    write(userId, ledger);
    return ledger;
  },

  async updateCard(userId: string, cardId: string, patch: Partial<DemoCard>): Promise<DemoLedger> {
    await delay(320);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const card = ledger.cards.find((c) => c.id === cardId) ?? ledger.cards[0];
    if (card) Object.assign(card, patch);
    write(userId, ledger);
    return ledger;
  },

  async issueCard(userId: string, type: "physical" | "virtual"): Promise<DemoLedger> {
    await delay(600);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const seed = hashSeed(userId + Date.now());
    ledger.cards = [
      {
        id: `card_${seed.toString(36)}`,
        nickname: type === "virtual" ? "Glass Virtual" : "Glass Metal",
        last4: String(1000 + (seed % 9000)),
        network: "Visa",
        type,
        status: "active",
        isLocked: false,
        isVirtual: type === "virtual",
        expiresAt: `0${(seed % 9) + 1}/30`,
        linkedAccount: ledger.accounts[0]?.name ?? "Everyday Checking",
        controls: { international: true, online: true, contactless: true, inStore: true, atm: true },
      },
      ...ledger.cards.filter((c) => c.status !== "active"),
    ];
    write(userId, ledger);
    return ledger;
  },

  // ---- savings goals -------------------------------------------------------

  async createGoal(
    userId: string,
    args: { name: string; emoji?: string; targetAmount: number; targetDate: string },
  ): Promise<DemoLedger> {
    await delay(280);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    ledger.goals = ledger.goals ?? [];
    ledger.goals.push({
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: args.name.trim(),
      emoji: args.emoji || "🎯",
      targetAmount: round2(Math.abs(args.targetAmount)),
      targetDate: args.targetDate,
      saved: 0,
      createdAt: new Date().toISOString(),
      contributions: [],
    });
    write(userId, ledger);
    return ledger;
  },

  async deleteGoal(userId: string, goalId: string): Promise<DemoLedger> {
    await delay(220);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const goal = (ledger.goals ?? []).find((g) => g.id === goalId);
    // Returning the money is the honest behaviour: the funds live in savings.
    ledger.goals = (ledger.goals ?? []).filter((g) => g.id !== goalId);
    if (ledger.roundUpGoalId === goalId) ledger.roundUpGoalId = null;
    if (goal && goal.saved > 0) {
      // Balance stays where it is (savings) — only the earmark disappears.
    }
    write(userId, ledger);
    return ledger;
  },

  /** Move money from checking into savings and earmark it against a goal. */
  async contributeToGoal(
    userId: string,
    args: { goalId: string; amount: number; source?: "manual" | "round-up"; note?: string },
  ): Promise<DemoLedger> {
    await delay(360);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const goal = (ledger.goals ?? []).find((g) => g.id === args.goalId);
    const from = ledger.accounts.find((a) => a.type === "checking");
    const to = ledger.accounts.find((a) => a.type === "savings");
    const amt = round2(Math.abs(args.amount));
    if (!goal || !from || !to || amt <= 0) throw new Error("Goal or accounts unavailable");
    if (from.availableBalance < amt) throw new Error("Not enough available in checking");

    const now = new Date().toISOString();
    ledger.transactions.unshift(
      {
        id: `tx_goal_${Date.now()}_out`,
        merchant: `Goal contribution — ${goal.name}`,
        category: "Transfers",
        amount: -amt,
        date: now,
        status: "posted",
        type: "debit",
        paymentMethod: args.source === "round-up" ? "Round-up sweep" : "Goal contribution",
        icon: goal.emoji,
        account: from.id,
      },
      {
        id: `tx_goal_${Date.now()}_in`,
        merchant: `Goal contribution — ${goal.name}`,
        category: "Transfers",
        amount: amt,
        date: now,
        status: "posted",
        type: "credit",
        paymentMethod: args.source === "round-up" ? "Round-up sweep" : "Goal contribution",
        icon: goal.emoji,
        account: to.id,
      },
    );
    from.currentBalance = round2(from.currentBalance - amt);
    from.availableBalance = round2(from.currentBalance - from.pendingAmount);
    to.currentBalance = round2(to.currentBalance + amt);
    to.availableBalance = round2(to.currentBalance - to.pendingAmount);

    goal.saved = round2(goal.saved + amt);
    goal.contributions.unshift({
      id: `gc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount: amt,
      date: now,
      source: args.source ?? "manual",
      note: args.note,
    });
    write(userId, ledger);
    return ledger;
  },

  async setRoundUpGoal(userId: string, goalId: string | null): Promise<DemoLedger> {
    await delay(200);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    ledger.roundUpGoalId = goalId;
    write(userId, ledger);
    return ledger;
  },

  /**
   * Round every unswept posted card debit up to the next dollar and sweep the
   * difference into the round-up goal. Each transaction is only ever counted
   * once (tracked by id), so repeated runs are idempotent.
   */
  async runRoundUpSweep(userId: string): Promise<{ ledger: DemoLedger; swept: number; count: number }> {
    await delay(420);
    const ledger = read(userId) ?? generateLedger(userId, "Account holder");
    const goalId = ledger.roundUpGoalId;
    const goal = (ledger.goals ?? []).find((g) => g.id === goalId);
    if (!goal) return { ledger, swept: 0, count: 0 };
    const done = new Set(ledger.roundUpSweptTxIds ?? []);
    const checking = ledger.accounts.find((a) => a.type === "checking");
    if (!checking) return { ledger, swept: 0, count: 0 };

    let total = 0;
    let count = 0;
    const cutoff = Date.now() - 30 * 86_400_000;
    for (const t of ledger.transactions) {
      if (t.account !== checking.id || t.amount >= 0 || t.status !== "posted") continue;
      if (done.has(t.id)) continue;
      if (+new Date(t.date) < cutoff) continue;
      if (t.category === "Transfers") continue;
      const abs = Math.abs(t.amount);
      const diff = round2(Math.ceil(abs) - abs);
      done.add(t.id);
      if (diff <= 0) continue;
      total = round2(total + diff);
      count += 1;
    }
    ledger.roundUpSweptTxIds = Array.from(done).slice(-2000);
    write(userId, ledger);
    if (total <= 0 || total > checking.availableBalance) {
      return { ledger, swept: 0, count: 0 };
    }
    const updated = await demoBank.contributeToGoal(userId, {
      goalId: goal.id,
      amount: total,
      source: "round-up",
      note: `${count} transactions rounded up`,
    });
    return { ledger: updated, swept: total, count };
  },
};

