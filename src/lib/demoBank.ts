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
}


const STORAGE_PREFIX = "glassbank.demo.v1:";
const ROUTING = "084106768";

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
    return ledger;
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
    const total = Math.abs(args.amount) + Math.abs(args.fee ?? 0);
    acct.currentBalance = round2(acct.currentBalance - total);
    acct.pendingAmount = round2(acct.pendingAmount + ((args.status ?? "pending") === "pending" ? total : 0));
    acct.availableBalance = round2(acct.currentBalance - acct.pendingAmount);
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

