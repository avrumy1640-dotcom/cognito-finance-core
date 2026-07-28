import { createContext, useContext, useReducer, ReactNode, useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import type { Transaction } from "@/types/transaction";
import { demoBank, type DemoLedger, type DemoAccount, type DemoCard } from "@/lib/demoBank";
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
  columnCardId?: string;
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
  columnLive: boolean;
  columnError: string | null;
  columnStatus: DataStatus;
  refreshColumn: (opts?: { silent?: boolean }) => Promise<void>;
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
    columnCardId: c.id,
  };
}

export const BankProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dataStatus, setDataStatus] = useState<DataStatus>("loading");
  const [dataError, setDataError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const ledgerRef = useRef<DemoLedger | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const applyLedger = useCallback(async (ledger: DemoLedger) => {
    ledgerRef.current = ledger;
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
    setDataError(null);
    setDataStatus("loaded");
  }, []);

  const refreshColumn = useCallback(async (opts?: { silent?: boolean }) => {
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
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const p = prof as { first_name?: string; last_name?: string } | null;
        holder = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
      }
      if (!holder) holder = user.email?.split("@")[0] ?? "Account holder";

      const ledger = await demoBank.load(user.id, holder, user.email ?? undefined);
      await applyLedger(ledger);
      if (!opts?.silent) toast.success("Account synced");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setDataError(msg);
      setDataStatus("error");
    }
  }, [applyLedger]);

  useEffect(() => {
    void refreshColumn({ silent: true });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshColumn({ silent: true });
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uid = () => userIdRef.current;

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
        toast.error(`${label} failed`, { id, description: err instanceof Error ? err.message : "Please try again." });
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
    if (from.availableBalance < args.amount) return false;
    void runMutation("Internal transfer", () => demoBank.internalTransfer(id, { fromId: from.id, toId: to.id, amount: args.amount, memo: args.memo }), `$${args.amount.toFixed(2)} to ${to.name}`);
    return true;
  }, [runMutation]);

  const send = useCallback((args: { from: "checking" | "savings"; amount: number; recipient: string; note?: string }) => {
    if (args.amount <= 0 || !args.recipient.trim()) return false;
    const from = accountFor(args.from);
    const id = uid();
    if (!from || !id || from.availableBalance < args.amount) return false;
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
    if (!from || !id || from.availableBalance < args.amount) return false;
    void runMutation(`Bill pay — ${args.biller}`, () => demoBank.debit(id, {
      accountId: from.id, amount: args.amount, merchant: args.biller,
      category: "Bills & Utilities", paymentMethod: "Bill pay", icon: "🧾",
    }), `$${args.amount.toFixed(2)} to ${args.biller}`);
    return true;
  }, [runMutation]);

  const externalTransfer = useCallback((args: { from: "checking" | "savings"; amount: number; bank: string; routingNumber: string; accountNumber: string; memo?: string }) => {
    if (args.amount <= 0) return false;
    const from = accountFor(args.from);
    const id = uid();
    if (!from || !id || from.availableBalance < args.amount) return false;
    void runMutation(`ACH transfer to ${args.bank}`, () => demoBank.debit(id, {
      accountId: from.id, amount: args.amount, merchant: args.bank,
      category: "Transfers", paymentMethod: "ACH transfer", icon: "🏦",
    }), `$${args.amount.toFixed(2)} to ${args.bank}`);
    return true;
  }, [runMutation]);

  const wireTransfer = useCallback((args: { from: "checking" | "savings"; amount: number; beneficiaryName: string; routingNumber: string; accountNumber: string; memo?: string; fee?: number }) => {
    const fee = args.fee ?? 25;
    if (args.amount <= 0) return false;
    const from = accountFor(args.from);
    const id = uid();
    if (!from || !id || from.availableBalance < args.amount + fee) return false;
    void runMutation(`Wire to ${args.beneficiaryName}`, () => demoBank.debit(id, {
      accountId: from.id, amount: args.amount, merchant: args.beneficiaryName,
      category: "Transfers", paymentMethod: "Wire transfer", icon: "🌐", fee,
    }), `$${args.amount.toFixed(2)} to ${args.beneficiaryName}`);
    return true;
  }, [runMutation]);

  const addFunds = useCallback(async (args: { to?: "checking" | "savings"; amount: number; source: string }) => {
    const to = accountFor(args.to ?? "checking");
    const id = uid();
    if (!to || !id || args.amount <= 0) return false;
    return runMutation("Deposit", () => demoBank.credit(id, {
      accountId: to.id, amount: args.amount, merchant: args.source,
      category: "Deposits", paymentMethod: args.source, icon: "💰", status: "posted",
    }), `$${args.amount.toFixed(2)} added to ${to.name}`);
  }, [runMutation]);

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
    columnLive: dataStatus === "loaded" && !!checking,
    columnError: dataError,
    columnStatus: dataStatus,
    refreshColumn,
    retry: () => void refreshColumn(),
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
  };

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
};

export const useBank = () => {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error("useBank must be used inside <BankProvider>");
  return ctx;
};
