import { createContext, useContext, useReducer, ReactNode, useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import type { Transaction } from "@/types/transaction";
import { ledgerProvider, isLiveMode, mergeProviderIntoLedger } from "@/lib/ledgerProvider";

import {
  demoBank,
  detectPayroll,
  type DemoLedger,
  type DemoAccount,
  type DemoCard,
  type DemoGoal,
  type DemoDispute,
  type DemoEarlyPayout,
  type DisputeReason,
  type PayrollPattern,
  type DemoReferral,
  type CashbackSummary,
  type CreditProfile,
  cashbackSummary,
  creditProfile,
  referralLinkFor,
  spendableBalance,
  cushionUsed,
  cushionLimitFor,
  overdraftEnabled,
  OVERDRAFT_CUSHION,
} from "@/lib/demoBank";
import { loadCategoryRules, categorize } from "@/lib/categorize";
import { supabase } from "@/integrations/supabase/client";

export type { Transaction };

/** Raise a real, persisted notification for the signed-in user (best effort). */
async function raiseNotification(args: {
  type: "transfer" | "card" | "security" | "alert";
  title: string;
  body?: string;
  dedupe_key?: string;
  data?: Record<string, unknown>;
}) {
  try {
    await supabase.functions.invoke("notify", { body: args });
  } catch {
    /* notification delivery must never break a money flow */
  }
}

export type Account = DemoAccount;

interface CardControls {
  international: boolean;
  online: boolean;
  contactless: boolean;
  inStore: boolean;
  atm: boolean;
}

interface CardState {
  nickname: string;
  last4: string;
  network: string;
  type: string;
  status: "active" | "locked" | "replaced" | "stolen" | "none";
  linkedAccount: string;
  expiresAt: string;
  isLocked: boolean;
  isVirtual: boolean;
  controls: CardControls;
  providerCardId?: string;
}

/** loading = first load in flight · loaded = ledger available · error = nothing to show */
export type DataStatus = "loading" | "loaded" | "error";

interface State {
  accounts: { checking: Account | null; savings: Account | null };
  transactions: Transaction[];
  card: CardState | null;
}

type Action =
  | { type: "HYDRATE"; accounts: { checking: Account | null; savings: Account | null }; transactions: Transaction[]; card: CardState | null }
  | { type: "CLEAR" }
  | { type: "SET_TX_CATEGORY"; id: string; category: string };

const initialState: State = {
  accounts: { checking: null, savings: null },
  transactions: [],
  card: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return { accounts: action.accounts, transactions: action.transactions, card: action.card };
    case "SET_TX_CATEGORY":
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === action.id ? { ...t, category: action.category } : t)),
      };
    case "CLEAR":
      return initialState;
    default:
      return state;
  }
}

interface Ctx {
  accounts: { checking: Account | null; savings: Account | null };
  transactions: Transaction[];
  card: CardState | null;
  totalBalance: number | null;
  dataStatus: DataStatus;
  dataError: string | null;
  /** Retained for existing screens: true once the ledger is available. */
  liveLedger: boolean;
  ledgerError: string | null;
  ledgerStatus: DataStatus;
  refreshLedger: (opts?: { silent?: boolean }) => Promise<void>;
  /** Live mode only: pull the next page of provider transactions into the feed. */
  loadMoreTransactions: () => Promise<void>;
  hasMoreTransactions: boolean;
  loadingMoreTransactions: boolean;
  retry: () => void;
  setTransactionCategory: (id: string, category: string) => Promise<void>;
  transfer: (args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => boolean;
  send: (args: { from: "checking" | "savings"; amount: number; recipient: string; note?: string }) => boolean;
  depositCheck: (args: { to: "checking" | "savings"; amount: number }) => boolean;
  payBill: (args: { from: "checking" | "savings"; amount: number; biller: string; routingNumber?: string; accountNumber?: string }) => boolean;
  externalTransfer: (args: { from: "checking" | "savings"; amount: number; bank: string; routingNumber: string; accountNumber: string; memo?: string }) => boolean;
  wireTransfer: (args: { from: "checking" | "savings"; amount: number; beneficiaryName: string; routingNumber: string; accountNumber: string; memo?: string; fee?: number }) => boolean;
  /** Credit an account — used by the Add Money flows. */
  addFunds: (args: { to?: "checking" | "savings"; amount: number; source: string }) => Promise<boolean>;
  toggleCardLock: () => Promise<void> | void;
  toggleCardControl: (key: keyof CardControls) => Promise<void> | void;
  replaceCard: () => Promise<void> | void;
  reportStolen: () => Promise<void> | void;
  issueCard: (args?: { type?: "physical" | "virtual" }) => Promise<boolean>;
  // --- savings goals ---
  goals: DemoGoal[];
  roundUpGoalId: string | null;
  createGoal: (args: { name: string; emoji?: string; targetAmount: number; targetDate: string }) => Promise<boolean>;
  contributeToGoal: (args: { goalId: string; amount: number }) => Promise<boolean>;
  deleteGoal: (goalId: string) => Promise<boolean>;
  setRoundUpGoal: (goalId: string | null) => Promise<boolean>;
  runRoundUpSweep: () => Promise<{ swept: number; count: number }>;
  // --- early paycheck access ---
  payroll: PayrollPattern | null;
  earlyPayouts: DemoEarlyPayout[];
  releaseEarlyPaycheck: () => Promise<boolean>;
  // --- disputes ---
  disputes: DemoDispute[];
  openDispute: (args: {
    transactionId: string;
    merchant: string;
    amount: number;
    reason: DisputeReason;
    note?: string;
    evidence?: { name: string; size: number; type: string }[];
  }) => Promise<DemoDispute | null>;
  // --- referrals ---
  referralCode: string;
  referralLink: string;
  referrals: DemoReferral[];
  inviteReferral: (args: { name: string; contact: string }) => Promise<boolean>;
  // --- cashback rewards ---
  cashback: CashbackSummary | null;
  redeemCashback: () => Promise<boolean>;
  // --- credit building ---
  credit: CreditProfile | null;
  // --- overdraft cushion ---
  cushion: { limit: number; used: number; remaining: number; enabled: boolean };
  /** Opt in to / out of the no-fee overdraft cushion. */
  setOverdraftOptIn: (enabled: boolean) => Promise<boolean>;
  /** Available balance plus any unused no-fee cushion. */
  spendable: (which?: "checking" | "savings") => number;
}


// While the ledger loads, screens still need a shape to read from. These
// carry zero balances (never fabricated numbers) and are swapped out the
// moment the real ledger resolves.
const placeholderAccount = (type: "checking" | "savings"): Account => ({
  id: `pending_${type}`,
  name: type === "checking" ? "Everyday Checking" : "High-Yield Savings",
  type,
  accountNumber: "••••0000",
  routingNumber: "",
  availableBalance: 0,
  currentBalance: 0,
  pendingAmount: 0,
  status: "Pending",
  openedDate: "",
  depositDetails: { accountNumber: "", iban: "", holderName: "", currency: "USD", reference: "" },
});

const PLACEHOLDER_ACCOUNTS = {
  checking: placeholderAccount("checking"),
  savings: placeholderAccount("savings"),
};

const BankContext = createContext<Ctx | null>(null);

function toCardState(c: DemoCard | undefined): CardState | null {
  if (!c) return null;
  return {
    nickname: c.nickname,
    last4: c.last4,
    network: c.network,
    type: c.type,
    status: c.status,
    linkedAccount: c.linkedAccount,
    expiresAt: c.expiresAt,
    isLocked: c.isLocked,
    isVirtual: c.isVirtual,
    controls: c.controls,
    providerCardId: c.id,
  };
}

export const BankProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dataStatus, setDataStatus] = useState<DataStatus>("loading");
  const [dataError, setDataError] = useState<string | null>(null);
  // Live-mode Activity window. The provider mirror is paged, so the feed grows
  // in 50-row steps instead of being hard-capped.
  const LIVE_TX_PAGE = 50;
  const liveTxWindowRef = useRef(LIVE_TX_PAGE);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
  const [goals, setGoals] = useState<DemoGoal[]>([]);
  const [roundUpGoalId, setRoundUpGoalId] = useState<string | null>(null);
  const [payroll, setPayroll] = useState<PayrollPattern | null>(null);
  const [earlyPayouts, setEarlyPayouts] = useState<DemoEarlyPayout[]>([]);
  const [disputes, setDisputes] = useState<DemoDispute[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<DemoReferral[]>([]);
  const [cashback, setCashback] = useState<CashbackSummary | null>(null);
  const [credit, setCredit] = useState<CreditProfile | null>(null);
  const [overdraftOptIn, setOverdraftOptIn] = useState(true);
  // Ids already seen, so a notification is only ever raised for genuinely new
  // activity (never for the whole history on first hydrate).
  const seenTxIds = useRef<Set<string> | null>(null);
  const lowBalanceNotified = useRef<string | null>(null);
  const disputeStatusRef = useRef<Map<string, string>>(new Map());
  const userIdRef = useRef<string | null>(null);
  const ledgerRef = useRef<DemoLedger | null>(null);
  const overdraftRef = useRef(true);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { overdraftRef.current = overdraftOptIn; }, [overdraftOptIn]);

  const applyLedger = useCallback(async (ledger: DemoLedger) => {
    ledgerRef.current = ledger;
    setGoals(ledger.goals ?? []);
    setRoundUpGoalId(ledger.roundUpGoalId ?? null);
    setPayroll(detectPayroll(ledger));
    setEarlyPayouts(ledger.earlyPayouts ?? []);
    const nextDisputes = ledger.disputes ?? [];
    // Notify when a case advances (submitted → under review → resolved).
    const known = disputeStatusRef.current;
    for (const d of nextDisputes) {
      const prev = known.get(d.id);
      if (prev && prev !== d.status) {
        void raiseNotification({
          type: "alert",
          title: `Dispute ${d.caseNumber} is ${d.status === "resolved" ? "resolved" : "under review"}`,
          body:
            d.status === "resolved"
              ? d.resolution ?? `We finished reviewing your $${d.amount.toFixed(2)} charge at ${d.merchant}.`
              : `Our team is reviewing your $${d.amount.toFixed(2)} charge at ${d.merchant}.`,
          dedupe_key: `dispute-${d.id}-${d.status}`,
        });
      }
      known.set(d.id, d.status);
    }
    setDisputes(nextDisputes);
    setReferralCode(ledger.referralCode ?? "");
    setReferrals(ledger.referrals ?? []);
    setCashback(cashbackSummary(ledger));
    setCredit(creditProfile(ledger));
    setOverdraftOptIn(overdraftEnabled(ledger));
    const checking = ledger.accounts.find((a) => a.type === "checking") ?? ledger.accounts[0] ?? null;

    const savings = ledger.accounts.find((a) => a.type === "savings") ?? null;

    // Real, rules-based categorisation on top of the ledger's own labels.
    let rules: Awaited<ReturnType<typeof loadCategoryRules>> = [];
    try { rules = await loadCategoryRules(); } catch { rules = []; }

    const nameFor = (id: string) =>
      ledger.accounts.find((a) => a.id === id)?.name ?? checking?.name ?? "Account";

    const txs: Transaction[] = ledger.transactions.map((t) => {
      let category = t.category;
      let merchant = t.merchant;
      if (rules.length) {
        const derived = categorize(t.merchant, t.type, rules);
        if (derived?.category && !t.category) category = derived.category;
        if (derived?.merchant) merchant = derived.merchant;
      }
      return {
        id: t.id,
        merchant,
        category,
        amount: t.amount,
        date: t.date,
        status: t.status,
        type: t.type,
        paymentMethod: t.paymentMethod,
        icon: t.icon,
        account: nameFor(t.account),
      };
    });

    dispatch({
      type: "HYDRATE",
      accounts: { checking, savings },
      transactions: txs,
      card: toCardState(ledger.cards.find((c) => c.status === "active") ?? ledger.cards[0]),
    });
    // --- push-style alerts on genuinely new activity ------------------------
    const first = seenTxIds.current === null;
    const seen = seenTxIds.current ?? new Set<string>();
    if (first) {
      ledger.transactions.forEach((t) => seen.add(t.id));
    } else {
      for (const t of ledger.transactions) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        const abs = Math.abs(t.amount);
        if (abs < 50) continue;
        const credit = t.amount > 0;
        void raiseNotification({
          type: credit ? "transfer" : "card",
          title: credit ? `Money in: $${abs.toFixed(2)}` : `Card charge: $${abs.toFixed(2)}`,
          body: `${t.merchant} · ${t.paymentMethod}`,
          dedupe_key: `tx-${t.id}`,
          data: { transactionId: t.id, amount: t.amount },
        });
      }
    }
    seenTxIds.current = seen;

    const available = checking?.availableBalance ?? null;
    if (available !== null && available < 100) {
      const stamp = new Date().toISOString().slice(0, 10);
      if (lowBalanceNotified.current !== stamp) {
        lowBalanceNotified.current = stamp;
        void raiseNotification({
          type: "alert",
          title: "Low balance",
          body: `${checking?.name ?? "Your account"} is down to $${available.toFixed(2)}.`,
          dedupe_key: `low-balance-${stamp}`,
        });
      }
    }

    setDataError(null);
    setDataStatus("loaded");
  }, []);

  const refreshLedger = useCallback(async (opts?: { silent?: boolean }) => {
    if (!stateRef.current.accounts.checking) setDataStatus("loading");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        // Signed out — nothing to show, and nothing broken.
        dispatch({ type: "CLEAR" });
        setDataStatus("loaded");
        setDataError(null);
        return;
      }
      userIdRef.current = user.id;
      let holder = (user.user_metadata?.full_name as string) || "";
      if (!holder) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("preferred_name")
          .eq("user_id", user.id)
          .maybeSingle();
        holder = (prof?.preferred_name ?? "").trim();
      }

      if (!holder) holder = user.email?.split("@")[0] ?? "Account holder";

      let ledger = await demoBank.load(user.id, holder, user.email ?? undefined);

      // Feature-flagged data-layer swap. In live mode the provider is the ONLY
      // source of truth: a failed call raises a real error state rather than
      // quietly showing stale or simulated numbers.
      if (isLiveMode()) {
        const snap = await ledgerProvider.sync({ limit: liveTxWindowRef.current });
        setHasMoreTransactions(!!snap.transactionsHasMore);
        if (!snap.provisioned) {
          setDataError(
            "No live account yet. Complete identity verification to have your bank account opened with our banking partner.",
          );
          setDataStatus("error");
          return;
        }
        ledger = mergeProviderIntoLedger(ledger, snap);
      }


      await applyLedger(ledger);
      if (!opts?.silent) toast.success("Account synced");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setDataError(msg);
      setDataStatus("error");
    }
  }, [applyLedger]);

  const loadMoreTransactions = useCallback(async () => {
    if (!isLiveMode() || !hasMoreTransactions || loadingMoreTransactions) return;
    setLoadingMoreTransactions(true);
    liveTxWindowRef.current += LIVE_TX_PAGE;
    try {
      await refreshLedger({ silent: true });
    } finally {
      setLoadingMoreTransactions(false);
    }
  }, [hasMoreTransactions, loadingMoreTransactions, refreshLedger]);



  useEffect(() => {
    void refreshLedger({ silent: true });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshLedger({ silent: true });
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live mode: webhook-driven updates land in the mirror tables, so subscribe
  // to them and re-hydrate the UI the moment our banking partner tells us
  // something changed — no manual refresh required.
  useEffect(() => {
    if (!isLiveMode()) return;
    const channel = supabase
      .channel("ledger-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "column_bank_accounts" },
        () => void refreshLedger({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "column_transfers" },
        () => void refreshLedger({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "column_entities" },
        () => void refreshLedger({ silent: true }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshLedger]);

  const uid = () => userIdRef.current;

  /**
   * Executes a money movement against the live provider. Used only in live
   * mode — there is no local simulation and no optimistic balance change.
   */
  const runLiveTransfer = useCallback(
    async (label: string, args: import("@/lib/ledgerProvider").TransferArgs, successBody?: string) => {
      const id = `live-${label}-${Date.now()}`;
      // Minted here, before the first attempt, so any retry replays the same
      // provider Idempotency-Key instead of creating a second transfer.
      const withRequestId = { ...args, requestId: args.requestId ?? crypto.randomUUID() };
      toast.loading(`${label}…`, { id });
      try {
        const res = await ledgerProvider.transfer(withRequestId);
        toast.success(`${label} submitted`, {
          id,
          description: successBody ? `${successBody} · ${res.status}` : `Status: ${res.status}`,
        });
        await refreshLedger({ silent: true });
        return true;
      } catch (err) {
        toast.error(`${label} failed`, { id, description: friendlyProviderMessage(err) });
        return false;
      }
    },
    [refreshLedger],
  );




  const runMutation = useCallback(
    async (label: string, fn: () => Promise<DemoLedger>, successBody?: string) => {
      const id = `bank-${label}-${Date.now()}`;
      toast.loading(`${label}…`, { id });
      try {
        const ledger = await fn();
        await applyLedger(ledger);
        toast.success(`${label} complete`, { id, description: successBody });
        if (successBody) void raiseNotification({ type: "transfer", title: `${label} complete`, body: successBody });
        return true;
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Please try again.";
        toast.error(`${label} failed`, { id, description: reason });
        void raiseNotification({
          type: "alert",
          title: `${label} declined`,
          body: reason,
          dedupe_key: `failed-${label}-${Date.now()}`,
        });
        return false;
      }
    },
    [applyLedger],
  );

  const accountFor = (which: "checking" | "savings") => stateRef.current.accounts[which];

  const transfer = useCallback((args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => {
    if (args.amount <= 0 || args.from === args.to) return false;
    const from = accountFor(args.from), to = accountFor(args.to);
    const id = uid();
    if (!from || !to || !id) return false;
    if (isLiveMode()) {
      void runLiveTransfer("Internal transfer", {
        kind: "book", amount: args.amount, from: args.from, to: args.to,
        description: args.memo || "Internal transfer",
      }, `$${args.amount.toFixed(2)} to ${to.name}`);
      return true;
    }
    if (spendableBalance(from, overdraftRef.current) < args.amount) return false;
    void runMutation("Internal transfer", () => demoBank.internalTransfer(id, { fromId: from.id, toId: to.id, amount: args.amount, memo: args.memo }), `$${args.amount.toFixed(2)} to ${to.name}`);
    return true;
  }, [runMutation, runLiveTransfer]);

  const send = useCallback((args: { from: "checking" | "savings"; amount: number; recipient: string; note?: string }) => {
    if (args.amount <= 0 || !args.recipient.trim()) return false;
    const from = accountFor(args.from);
    const id = uid();
    if (!from || !id) return false;
    if (isLiveMode()) {
      toast.error("Peer-to-peer send is not available in live mode", {
        description: "Use Bank transfer (ACH) or Wire to move money to a real account.",
      });
      return false;
    }
    if (spendableBalance(from, overdraftRef.current) < args.amount) return false;
    void runMutation("Payment", () => demoBank.debit(id, {
      accountId: from.id, amount: args.amount, merchant: args.recipient,
      category: "Transfers", paymentMethod: "Instant send", icon: "⚡️",
    }), `$${args.amount.toFixed(2)} to ${args.recipient}`);
    return true;
  }, [runMutation]);

  const depositCheck = useCallback((args: { to: "checking" | "savings"; amount: number }) => {
    if (args.amount <= 0) return false;
    const to = accountFor(args.to);
    const id = uid();
    if (!to || !id) return false;
    if (isLiveMode()) {
      toast.error("Mobile check deposit is not supported in live mode", {
        description: "Fund the account with an incoming bank transfer instead.",
      });
      return false;
    }
    void runMutation("Check deposit", () => demoBank.credit(id, {
      accountId: to.id, amount: args.amount, merchant: "Mobile check deposit",
      category: "Deposits", paymentMethod: "Mobile deposit", icon: "🧾", status: "pending",
    }), `$${args.amount.toFixed(2)} deposited`);
    return true;
  }, [runMutation]);

  const payBill = useCallback((args: { from: "checking" | "savings"; amount: number; biller: string; routingNumber?: string; accountNumber?: string }) => {
    if (args.amount <= 0 || !args.biller.trim()) return false;
    const from = accountFor(args.from);
    const id = uid();
    if (!from || !id) return false;
    if (isLiveMode()) {
      if (!args.routingNumber || !args.accountNumber) {
        toast.error("Bill pay needs the biller's routing and account number in live mode");
        return false;
      }
      void runLiveTransfer(`Bill pay — ${args.biller}`, {
        kind: "ach", amount: args.amount, from: args.from, name: args.biller,
        routingNumber: args.routingNumber, accountNumber: args.accountNumber,
        description: "BILLPAY",
      }, `$${args.amount.toFixed(2)} to ${args.biller}`);
      return true;
    }
    if (spendableBalance(from, overdraftRef.current) < args.amount) return false;
    void runMutation(`Bill pay — ${args.biller}`, () => demoBank.debit(id, {
      accountId: from.id, amount: args.amount, merchant: args.biller,
      category: "Bills & Utilities", paymentMethod: "Bill pay", icon: "🧾",
    }), `$${args.amount.toFixed(2)} to ${args.biller}`);
    return true;
  }, [runMutation, runLiveTransfer]);

  const externalTransfer = useCallback((args: { from: "checking" | "savings"; amount: number; bank: string; routingNumber: string; accountNumber: string; memo?: string }) => {
    if (args.amount <= 0) return false;
    const from = accountFor(args.from);
    const id = uid();
    if (!from || !id) return false;
    if (isLiveMode()) {
      void runLiveTransfer(`ACH transfer to ${args.bank}`, {
        kind: "ach", amount: args.amount, from: args.from, name: args.bank,
        routingNumber: args.routingNumber, accountNumber: args.accountNumber,
        description: "TRANSFER",
      }, `$${args.amount.toFixed(2)} to ${args.bank}`);
      return true;
    }
    if (spendableBalance(from, overdraftRef.current) < args.amount) return false;
    void runMutation(`ACH transfer to ${args.bank}`, () => demoBank.debit(id, {
      accountId: from.id, amount: args.amount, merchant: args.bank,
      category: "Transfers", paymentMethod: "ACH transfer", icon: "🏦",
    }), `$${args.amount.toFixed(2)} to ${args.bank}`);
    return true;
  }, [runMutation, runLiveTransfer]);

  const wireTransfer = useCallback((args: { from: "checking" | "savings"; amount: number; beneficiaryName: string; routingNumber: string; accountNumber: string; memo?: string; fee?: number }) => {
    const fee = args.fee ?? 25;
    if (args.amount <= 0) return false;
    const from = accountFor(args.from);
    const id = uid();
    if (!from || !id) return false;
    if (isLiveMode()) {
      void runLiveTransfer(`Wire to ${args.beneficiaryName}`, {
        kind: "wire", amount: args.amount, from: args.from, name: args.beneficiaryName,
        routingNumber: args.routingNumber, accountNumber: args.accountNumber,
        description: args.memo || "Wire transfer",
      }, `$${args.amount.toFixed(2)} to ${args.beneficiaryName}`);
      return true;
    }
    if (spendableBalance(from, overdraftRef.current) < args.amount + fee) return false;
    void runMutation(`Wire to ${args.beneficiaryName}`, () => demoBank.debit(id, {
      accountId: from.id, amount: args.amount, merchant: args.beneficiaryName,
      category: "Transfers", paymentMethod: "Wire transfer", icon: "🌐", fee,
    }), `$${args.amount.toFixed(2)} to ${args.beneficiaryName}`);
    return true;
  }, [runMutation, runLiveTransfer]);

  const addFunds = useCallback(async (args: {
    to?: "checking" | "savings"; amount: number; source: string;
    routingNumber?: string; accountNumber?: string;
  }) => {
    const to = accountFor(args.to ?? "checking");
    const id = uid();
    if (!to || !id || args.amount <= 0) return false;
    if (isLiveMode()) {
      if (!args.routingNumber || !args.accountNumber) {
        toast.error("Add the funding account's routing and account number", {
          description: "Live mode pulls the money from a real external account.",
        });
        return false;
      }
      return runLiveTransfer("Deposit", {
        kind: "ach_pull", amount: args.amount, from: args.to ?? "checking",
        name: args.source, routingNumber: args.routingNumber, accountNumber: args.accountNumber,
        description: "DEPOSIT",
      }, `$${args.amount.toFixed(2)} into ${to.name}`);
    }
    return runMutation("Deposit", () => demoBank.credit(id, {
      accountId: to.id, amount: args.amount, merchant: args.source,
      category: "Deposits", paymentMethod: args.source, icon: "💰", status: "posted",
    }), `$${args.amount.toFixed(2)} added to ${to.name}`);
  }, [runMutation, runLiveTransfer]);


  const cardId = () => ledgerRef.current?.cards.find((c) => c.status !== "replaced")?.id ?? ledgerRef.current?.cards[0]?.id;

  const toggleCardLock = useCallback(async () => {
    const id = uid(); const cid = cardId();
    if (!id || !cid) return;
    const locked = !stateRef.current.card?.isLocked;
    await runMutation(locked ? "Locking card" : "Unlocking card", () =>
      demoBank.updateCard(id, cid, { isLocked: locked, status: locked ? "locked" : "active" }));
  }, [runMutation]);

  const toggleCardControl = useCallback(async (key: keyof CardControls) => {
    const id = uid(); const cid = cardId();
    const current = stateRef.current.card;
    if (!id || !cid || !current) return;
    await runMutation("Updating card controls", () =>
      demoBank.updateCard(id, cid, { controls: { ...current.controls, [key]: !current.controls[key] } }));
  }, [runMutation]);

  const replaceCard = useCallback(async () => {
    const id = uid();
    if (!id) return;
    await runMutation("Ordering replacement card", () => demoBank.issueCard(id, "physical"));
  }, [runMutation]);

  const reportStolen = useCallback(async () => {
    const id = uid(); const cid = cardId();
    if (!id || !cid) return;
    await runMutation("Reporting card stolen", () =>
      demoBank.updateCard(id, cid, { status: "stolen", isLocked: true }));
  }, [runMutation]);

  const issueCard = useCallback(async (args?: { type?: "physical" | "virtual" }) => {
    const id = uid();
    if (!id) return false;
    return runMutation("Issuing card", () => demoBank.issueCard(id, args?.type ?? "virtual"));
  }, [runMutation]);

  const setTransactionCategory = useCallback(async (id: string, category: string) => {
    dispatch({ type: "SET_TX_CATEGORY", id, category });
    toast.success(`Categorised as ${category}`);
  }, []);

  // --- savings goals --------------------------------------------------------
  const createGoal = useCallback(async (args: { name: string; emoji?: string; targetAmount: number; targetDate: string }) => {
    const id = uid();
    if (!id) return false;
    return runMutation("Creating goal", () => demoBank.createGoal(id, args));
  }, [runMutation]);

  const contributeToGoal = useCallback(async (args: { goalId: string; amount: number }) => {
    const id = uid();
    if (!id) return false;
    return runMutation("Adding to goal", () => demoBank.contributeToGoal(id, args));
  }, [runMutation]);

  const deleteGoal = useCallback(async (goalId: string) => {
    const id = uid();
    if (!id) return false;
    return runMutation("Removing goal", () => demoBank.deleteGoal(id, goalId));
  }, [runMutation]);

  const setRoundUpGoal = useCallback(async (goalId: string | null) => {
    const id = uid();
    if (!id) return false;
    return runMutation(goalId ? "Enabling round-ups" : "Turning off round-ups", () => demoBank.setRoundUpGoal(id, goalId));
  }, [runMutation]);

  const runRoundUpSweep = useCallback(async () => {
    const id = uid();
    if (!id) return { swept: 0, count: 0 };
    const toastId = `roundup-${Date.now()}`;
    toast.loading("Sweeping round-ups…", { id: toastId });
    try {
      const { ledger, swept, count } = await demoBank.runRoundUpSweep(id);
      await applyLedger(ledger);
      
      if (swept > 0) toast.success(`Swept $${swept.toFixed(2)} from ${count} transactions`, { id: toastId });
      else toast.info("Nothing new to round up yet", { id: toastId });
      return { swept, count };
    } catch (err) {
      toast.error("Round-up sweep failed", { id: toastId, description: err instanceof Error ? err.message : undefined });
      return { swept: 0, count: 0 };
    }
  }, [applyLedger]);

  // --- early paycheck access ------------------------------------------------
  const releaseEarlyPaycheck = useCallback(async () => {
    const id = uid();
    if (!id) return false;
    return runMutation(
      "Releasing your paycheck",
      () => demoBank.releaseEarlyPaycheck(id),
      "Your paycheck is available now",
    );
  }, [runMutation]);

  // --- disputes -------------------------------------------------------------
  const openDispute = useCallback(
    async (args: {
      transactionId: string;
      merchant: string;
      amount: number;
      reason: DisputeReason;
      note?: string;
      evidence?: { name: string; size: number; type: string }[];
    }) => {
      const id = uid();
      if (!id) return null;
      const toastId = `dispute-${Date.now()}`;
      toast.loading("Submitting dispute…", { id: toastId });
      try {
        const { ledger, dispute } = await demoBank.openDispute(id, args);
        await applyLedger(ledger);
        toast.success(`Dispute opened · ${dispute.caseNumber}`, { id: toastId });
        void raiseNotification({
          type: "alert",
          title: `Dispute received — ${dispute.caseNumber}`,
          body: `We're reviewing your $${dispute.amount.toFixed(2)} charge at ${dispute.merchant}.`,
          dedupe_key: `dispute-${dispute.id}`,
        });
        return dispute;
      } catch (err) {
        toast.error("Couldn't open dispute", { id: toastId, description: err instanceof Error ? err.message : undefined });
        return null;
      }
    },
    [applyLedger],
  );

  // --- referrals ------------------------------------------------------------
  const inviteReferral = useCallback(async (args: { name: string; contact: string }) => {
    const id = uid();
    if (!id) return false;
    return runMutation("Sending invite", () => demoBank.inviteReferral(id, args), `${args.name} was invited`);
  }, [runMutation]);

  // --- cashback rewards -----------------------------------------------------
  const redeemCashback = useCallback(async () => {
    const id = uid();
    if (!id) return false;
    const toastId = `cashback-${Date.now()}`;
    toast.loading("Redeeming cashback…", { id: toastId });
    try {
      const { ledger, amount } = await demoBank.redeemCashback(id);
      await applyLedger(ledger);
      toast.success(`$${amount.toFixed(2)} cashback added to checking`, { id: toastId });
      void raiseNotification({
        type: "transfer",
        title: `Cashback redeemed: $${amount.toFixed(2)}`,
        body: "Your Glass Card rewards were credited to checking.",
        dedupe_key: `cashback-${Date.now()}`,
      });
      return true;
    } catch (err) {
      toast.error("Couldn't redeem cashback", { id: toastId, description: err instanceof Error ? err.message : undefined });
      return false;
    }
  }, [applyLedger]);

  // --- overdraft cushion ----------------------------------------------------
  const setOverdraftPreference = useCallback(async (enabled: boolean) => {
    const id = uid();
    if (!id) return false;
    const toastId = `overdraft-${Date.now()}`;
    toast.loading(enabled ? "Turning on your cushion…" : "Turning off your cushion…", { id: toastId });
    try {
      const ledger = await demoBank.setOverdraftOptIn(id, enabled);
      await applyLedger(ledger);
      toast.success(enabled ? "Overdraft cushion is on" : "Overdraft cushion is off", {
        id: toastId,
        description: enabled
          ? `Checking can dip up to $${OVERDRAFT_CUSHION} below zero with no fee.`
          : "Payments over your available balance will be declined.",
      });
      return true;
    } catch (err) {
      toast.error("Couldn't update your cushion", { id: toastId, description: err instanceof Error ? err.message : undefined });
      return false;
    }
  }, [applyLedger]);

  const { checking, savings } = state.accounts;
  const totalBalance =
    dataStatus === "loaded" && checking
      ? checking.availableBalance + (savings?.availableBalance ?? 0)
      : null;

  const value: Ctx = {
    accounts: state.accounts.checking ? state.accounts : PLACEHOLDER_ACCOUNTS,
    transactions: state.transactions,
    card: state.card,
    totalBalance,
    dataStatus,
    dataError,
    liveLedger: dataStatus === "loaded" && !!checking,
    ledgerError: dataError,
    ledgerStatus: dataStatus,
    refreshLedger,
    loadMoreTransactions,
    hasMoreTransactions,
    loadingMoreTransactions,
    retry: () => void refreshLedger(),
    setTransactionCategory,
    transfer,
    send,
    depositCheck,
    payBill,
    externalTransfer,
    wireTransfer,
    addFunds,
    toggleCardLock,
    toggleCardControl,
    replaceCard,
    reportStolen,
    issueCard,
    goals,
    roundUpGoalId,
    createGoal,
    contributeToGoal,
    deleteGoal,
    setRoundUpGoal,
    runRoundUpSweep,
    payroll,
    earlyPayouts,
    releaseEarlyPaycheck,
    disputes,
    openDispute,
    referralCode,
    referralLink: referralLinkFor(referralCode || "GLASSBANK"),
    referrals,
    inviteReferral,
    cashback,
    redeemCashback,
    credit,
    cushion: {
      limit: overdraftOptIn ? (checking ? cushionLimitFor(checking, true) : OVERDRAFT_CUSHION) : 0,
      used: cushionUsed(checking, overdraftOptIn),
      remaining: Math.round(
        (((overdraftOptIn ? (checking ? cushionLimitFor(checking, true) : OVERDRAFT_CUSHION) : 0)) -
          cushionUsed(checking, overdraftOptIn)) * 100,
      ) / 100,
      enabled: overdraftOptIn,
    },
    setOverdraftOptIn: setOverdraftPreference,
    spendable: (which: "checking" | "savings" = "checking") =>
      spendableBalance(state.accounts[which], overdraftOptIn),
  };


  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
};

export const useBank = () => {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error("useBank must be used inside <BankProvider>");
  return ctx;
};
