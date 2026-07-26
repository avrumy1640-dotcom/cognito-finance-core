import { createContext, useContext, useReducer, ReactNode, useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import type { Transaction } from "@/types/transaction";
import {
  iberbancoApi,
  mapIberAccount,
  mapIberTransaction,
  fetchMyIberUserNumber,
  CURRENCY_LABEL,
  type IberAccount,
} from "@/lib/iberbancoClient";
import { loadAlertPrefs } from "@/lib/alerts";
import {
  loadCategoryRules,
  categorize,
  fetchStoredCategories,
  persistDerivedCategories,
} from "@/lib/categorize";
import { supabase } from "@/integrations/supabase/client";

export type { Transaction };

// Wraps a mutation so the user always sees loading, success, and error state
// with a Retry action instead of a silent console warn.
async function runIber<T>(label: string, fn: () => Promise<T>, opts?: { silentSuccess?: boolean }): Promise<T | null> {
  const id = `iber-${label}-${Date.now()}`;
  toast.loading(`${label}…`, { id });
  try {
    const result = await fn();
    if (opts?.silentSuccess) toast.dismiss(id);
    else toast.success(`${label} complete`, { id });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    toast.error(`${label} failed`, {
      id,
      description: message,
      action: { label: "Retry", onClick: () => void runIber(label, fn, opts) },
    });
    return null;
  }
}

/** Raise a real, persisted notification for the signed-in user. */
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

export type Account = {
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
  depositDetails?: {
    accountNumber: string;
    iban: string;
    holderName: string;
    currency: string;
    reference: string;
  };
};

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

/** loading = first fetch in flight · loaded = real backend data · error = nothing to show */
export type DataStatus = "loading" | "loaded" | "error";

interface State {
  accounts: { checking: Account | null; savings: Account | null };
  transactions: Transaction[];
  card: CardState | null;
}

type Action =
  | { type: "HYDRATE"; accounts: { checking: Account | null; savings: Account | null }; transactions: Transaction[] }
  | { type: "HYDRATE_CARD"; card: CardState | null }
  | { type: "CLEAR" }
  | { type: "SET_TX_CATEGORY"; id: string; category: string };

const initialState: State = {
  accounts: { checking: null, savings: null },
  transactions: [],
  card: null,
};

const DEFAULT_CONTROLS: CardControls = {
  international: true,
  online: true,
  contactless: true,
  inStore: true,
  atm: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, accounts: action.accounts, transactions: action.transactions };
    case "HYDRATE_CARD":
      return { ...state, card: action.card };
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
  /** Explicit load state. Screens must not render balances unless this is "loaded". */
  dataStatus: DataStatus;
  dataError: string | null;
  /** True when live Iberbanco data is available for money movement. */
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
  toggleCardLock: () => Promise<void> | void;
  toggleCardControl: (key: keyof CardControls) => Promise<void> | void;
  replaceCard: () => Promise<void> | void;
  reportStolen: () => Promise<void> | void;
  issueCard: (args?: { type?: "physical" | "virtual" }) => Promise<boolean>;
}

const BankContext = createContext<Ctx | null>(null);

export const BankProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dataStatus, setDataStatus] = useState<DataStatus>("loading");
  const [dataError, setDataError] = useState<string | null>(null);
  const [columnLive, setColumnLive] = useState(false);
  const userNumberRef = useRef<string | null>(null);
  const notifiedErrorRef = useRef<string | null>(null);
  const knownTxIdsRef = useRef<Set<string>>(new Set());
  const lastCardStateRef = useRef<string | null>(null);
  const lowBalanceFiredRef = useRef<Record<string, boolean>>({});
  const firstSyncRef = useRef(true);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const fail = useCallback((msg: string, silent?: boolean, toastId?: string) => {
    setColumnLive(false);
    setDataError(msg);
    setDataStatus("error");
    // Nothing is rendered from a previous sync once we know the data is stale
    // and unverifiable — an empty, honest screen beats a stale/fake balance.
    dispatch({ type: "CLEAR" });
    if (!silent || notifiedErrorRef.current !== msg) {
      notifiedErrorRef.current = msg;
      toast.error("Couldn't load your account", {
        id: toastId,
        description: msg,
        action: { label: "Retry", onClick: () => void refreshRef.current?.() },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshRef = useRef<((opts?: { silent?: boolean }) => Promise<void>) | null>(null);

  const refreshColumn = useCallback(async (opts?: { silent?: boolean }) => {
    if (stateRef.current.accounts.checking === null) setDataStatus("loading");
    const toastId = opts?.silent ? undefined : `iber-sync`;
    if (!opts?.silent) toast.loading("Syncing with your bank…", { id: toastId });
    try {
      const userNumber = userNumberRef.current ?? (await fetchMyIberUserNumber());
      if (!userNumber) {
        fail("Complete identity verification to link your account.", opts?.silent, toastId);
        return;
      }
      userNumberRef.current = userNumber;

      const accountsList = await iberbancoApi.listAccounts(userNumber);
      const active: IberAccount[] = (accountsList || []).filter((a) => a.status !== 3);
      if (active.length === 0) {
        fail("No active accounts found for your profile.", opts?.silent, toastId);
        return;
      }

      const primary = active.find((a) => a.currency === 1) || active[0];
      const secondary = active.find((a) => a !== primary) || null;

      const checking: Account = {
        ...mapIberAccount(primary),
        type: "checking" as const,
        name: mapIberAccount(primary).name || "Primary Account",
      };
      const savings: Account | null = secondary
        ? { ...mapIberAccount(secondary), type: "savings" as const }
        : null;

      const [chkTx, savTx] = await Promise.all([
        iberbancoApi.listTransactions(primary.account_special_number).catch(() => []),
        secondary && secondary.account_special_number !== primary.account_special_number
          ? iberbancoApi.listTransactions(secondary.account_special_number).catch(() => [])
          : Promise.resolve([]),
      ]);

      // ---- Real categorization -----------------------------------------
      const rules = await loadCategoryRules();
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const stored = uid ? await fetchStoredCategories(uid) : new Map();

      const rawTxs: Transaction[] = [
        ...chkTx.map((t) => mapIberTransaction(t, checking.name, primary.account_special_number)),
        ...(secondary ? savTx.map((t) => mapIberTransaction(t, savings?.name ?? "Savings", secondary.account_special_number)) : []),
      ];

      const derived: Array<{ transaction_ref: string; category: string; merchant_normalized: string }> = [];
      const txs = rawTxs.map((t) => {
        const { category, merchant } = categorize(t.merchant, t.type, rules);
        derived.push({ transaction_ref: t.id, category, merchant_normalized: merchant });
        const override = stored.get(t.id);
        return {
          ...t,
          merchant: merchant || t.merchant,
          category: override?.is_override ? override.category : category,
        };
      });
      if (uid) void persistDerivedCategories(uid, derived, stored);

      // ---- Alerts on genuinely new activity ------------------------------
      const prefs = loadAlertPrefs();
      const isFirstSync = firstSyncRef.current;
      if (prefs.enabled && !isFirstSync) {
        for (const t of txs) {
          if (knownTxIdsRef.current.has(t.id)) continue;
          const abs = Math.abs(t.amount);
          if (abs >= prefs.largeTxnAmount) {
            toast.warning(`Large ${t.type === "credit" ? "deposit" : "charge"}: $${abs.toFixed(2)}`, {
              description: `${t.merchant} • ${t.account}`,
            });
          }
        }
        for (const [key, acc] of Object.entries({ checking, savings })) {
          if (!acc) continue;
          const below = acc.availableBalance < prefs.lowBalance;
          if (below && !lowBalanceFiredRef.current[key]) {
            lowBalanceFiredRef.current[key] = true;
            toast.warning(`Low balance on ${acc.name}`, {
              description: `Available $${acc.availableBalance.toFixed(2)} is below your $${prefs.lowBalance} threshold.`,
            });
          } else if (!below) {
            lowBalanceFiredRef.current[key] = false;
          }
        }
      }
      for (const t of txs) knownTxIdsRef.current.add(t.id);
      firstSyncRef.current = false;

      dispatch({ type: "HYDRATE", accounts: { checking, savings }, transactions: txs });

      // ---- Card (absent is a real state, not a placeholder) ---------------
      try {
        const cards = await iberbancoApi.listCards(userNumber);
        const c = cards[0];
        if (c) {
          const next: CardState = {
            nickname: "Glass Card",
            columnCardId: c.remote_id,
            last4: (c.cardNumber || "").slice(-4) || "0000",
            network: "Visa",
            type: c.type === 1 ? "virtual" : "physical",
            isVirtual: c.type === 1,
            expiresAt: c.expire_date || "",
            linkedAccount: checking.name,
            status: c.status === 1 ? "active" : c.status === 2 ? "locked" : c.status === 6 || c.status === 7 ? "stolen" : "active",
            isLocked: c.status !== 1,
            controls: DEFAULT_CONTROLS,
          };
          dispatch({ type: "HYDRATE_CARD", card: next });
          const nextCardState = String(c.status ?? "");
          if (lastCardStateRef.current && lastCardStateRef.current !== nextCardState) {
            void raiseNotification({
              type: "card",
              title: "Card status changed",
              body: `Your card •••• ${next.last4} status is now ${nextCardState}.`,
              dedupe_key: `card:${c.remote_id}:${nextCardState}`,
            });
          }
          lastCardStateRef.current = nextCardState;
        } else {
          dispatch({ type: "HYDRATE_CARD", card: null });
        }
      } catch {
        dispatch({ type: "HYDRATE_CARD", card: null });
      }

      setColumnLive(true);
      setDataError(null);
      setDataStatus("loaded");
      notifiedErrorRef.current = null;
      if (!opts?.silent) toast.success("Account synced", { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "We couldn't reach your bank.";
      fail(msg, opts?.silent, toastId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fail]);

  useEffect(() => { refreshRef.current = refreshColumn; }, [refreshColumn]);

  useEffect(() => {
    void refreshColumn({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prefs = loadAlertPrefs();
    if (!prefs.enabled) return;
    const ms = Math.max(10, prefs.pollSeconds) * 1000;
    const id = window.setInterval(() => { void refreshColumn({ silent: true }); }, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase.channel("iberbanco-events");
    channel.on("broadcast", { event: "*" }, () => { void refreshColumn({ silent: true }); }).subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requireLive = (label: string): boolean => {
    if (!columnLive || !userNumberRef.current) {
      toast.error(`${label} unavailable`, {
        description: "Your account isn't linked yet. Complete identity verification to move real money.",
      });
      return false;
    }
    return true;
  };

  const afterMutation = (label: string, amount: number, target: string) => (res: unknown) => {
    if (res) {
      void raiseNotification({
        type: "transfer",
        title: `${label} sent`,
        body: `$${amount.toFixed(2)} to ${target}`,
      });
      void refreshColumn({ silent: true });
    } else {
      void raiseNotification({
        type: "alert",
        title: `${label} failed`,
        body: `$${amount.toFixed(2)} to ${target} was not sent.`,
      });
    }
  };

  const transfer = useCallback((args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => {
    if (args.amount <= 0 || args.from === args.to) return false;
    const s = stateRef.current;
    const fromAcc = s.accounts[args.from];
    const toAcc = s.accounts[args.to];
    if (!fromAcc || !toAcc) return false;
    if (fromAcc.availableBalance < args.amount) return false;
    if (!requireLive("Internal transfer")) return false;
    runIber("Internal transfer", () =>
      iberbancoApi.createInternalTransfer({
        user_number: userNumberRef.current!,
        account_number_from: fromAcc.id,
        account_number_to: toAcc.id,
        amount: Math.round(args.amount),
        reference: (args.memo || "Internal transfer").slice(0, 60),
      }),
    ).then(afterMutation("Internal transfer", args.amount, toAcc.name));
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnLive, refreshColumn]);

  const send = useCallback(() => {
    toast.error("Send Money is coming soon", {
      description: "Peer-to-peer payments aren't available on this account yet. Use External Transfer, Wire, or Bill Pay to send funds.",
    });
    return false;
  }, []);

  const depositCheck = useCallback(() => {
    toast.error("Mobile check deposit is coming soon", {
      description: "Fund your account via ACH or wire in the meantime.",
    });
    return false;
  }, []);

  const payBill = useCallback((args: {
    from: "checking" | "savings";
    amount: number;
    biller: string;
    routingNumber?: string;
    accountNumber?: string;
  }) => {
    if (args.amount <= 0 || !args.biller.trim()) return false;
    const fromAcc = stateRef.current.accounts[args.from];
    if (!fromAcc || fromAcc.availableBalance < args.amount) return false;
    if (!args.accountNumber) {
      toast.error("Bill pay failed", { description: "A payee account number is required." });
      return false;
    }
    if (!requireLive("Bill pay")) return false;
    runIber(`Bill pay — ${args.biller}`, () =>
      iberbancoApi.createBillPayment({
        user_number: userNumberRef.current!,
        account_number: fromAcc.id,
        amount: Math.round(args.amount),
        reference: args.biller.slice(0, 60),
        payee_name: args.biller,
        payee_code: (args.routingNumber || "BILL").slice(0, 20),
        payee_account_number: args.accountNumber,
        beneficiary_email: `noreply+${args.biller.toLowerCase().replace(/\s+/g, "")}@example.com`,
      }),
    ).then(afterMutation("Bill payment", args.amount, args.biller));
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnLive, refreshColumn]);

  const externalTransfer = useCallback((args: {
    from: "checking" | "savings";
    amount: number;
    bank: string;
    routingNumber: string;
    accountNumber: string;
    memo?: string;
  }) => {
    if (args.amount <= 0) return false;
    const fromAcc = stateRef.current.accounts[args.from];
    if (!fromAcc || fromAcc.availableBalance < args.amount) return false;
    if (!requireLive("ACH transfer")) return false;
    runIber(`ACH transfer to ${args.bank}`, () =>
      iberbancoApi.createAchTransfer({
        user_number: userNumberRef.current!,
        account_number: fromAcc.id,
        amount: Math.round(args.amount),
        reference: (args.memo || args.bank).slice(0, 60),
        beneficiary_name: args.bank,
        beneficiary_address: "N/A",
        beneficiary_email: `noreply+${args.bank.toLowerCase().replace(/\s+/g, "")}@example.com`,
        bank_name: args.bank,
        bank_country: "United States",
        bank_address: "N/A",
        beneficiary_account_number: args.accountNumber,
        institution_number: args.routingNumber.slice(0, 3),
        transit_number: args.routingNumber.slice(-5),
      }),
    ).then(afterMutation("ACH transfer", args.amount, args.bank));
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnLive, refreshColumn]);

  const wireTransfer = useCallback((args: {
    from: "checking" | "savings";
    amount: number;
    beneficiaryName: string;
    routingNumber: string;
    accountNumber: string;
    memo?: string;
    fee?: number;
  }) => {
    const fee = args.fee ?? 25;
    if (args.amount <= 0) return false;
    const fromAcc = stateRef.current.accounts[args.from];
    if (!fromAcc || fromAcc.availableBalance < args.amount + fee) return false;
    if (!requireLive("Wire transfer")) return false;
    runIber(`Wire to ${args.beneficiaryName}`, () =>
      iberbancoApi.createSwiftTransfer({
        user_number: userNumberRef.current!,
        account_number: fromAcc.id,
        amount: Math.round(args.amount),
        reference: (args.memo || args.beneficiaryName).slice(0, 60),
        iban_code: args.accountNumber,
        beneficiary_name: args.beneficiaryName,
        beneficiary_country: "United States",
        beneficiary_state: "N/A",
        beneficiary_city: "N/A",
        beneficiary_address: "N/A",
        beneficiary_zip_code: "00000",
        swift_code: args.routingNumber,
        bank_name: "Beneficiary Bank",
        bank_country: "United States",
        bank_state: "N/A",
        bank_city: "N/A",
        bank_address: "N/A",
        bank_zip_code: "00000",
      }),
    ).then(afterMutation("Wire transfer", args.amount, args.beneficiaryName));
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnLive, refreshColumn]);

  // Iberbanco v2 does not expose card lock/unlock/reissue/controls/PIN.
  const cardCapabilityUnavailable = (feature: string) => {
    toast.error(`${feature} isn't available yet`, {
      description: "Your card issuer doesn't expose this control on the current API. Contact support to change it.",
    });
  };
  const toggleCardLock = useCallback(async () => { cardCapabilityUnavailable("Card lock"); }, []);
  const toggleCardControl = useCallback(async () => { cardCapabilityUnavailable("Card controls"); }, []);
  const replaceCard = useCallback(async () => { cardCapabilityUnavailable("Card replacement"); }, []);
  const reportStolen = useCallback(async () => { cardCapabilityUnavailable("Report lost/stolen"); }, []);

  const issueCard = useCallback(async (args?: { type?: "physical" | "virtual" }) => {
    if (!columnLive || !userNumberRef.current) {
      toast.error("Card issuance unavailable", {
        description: "We couldn't reach your bank. Try again once your account loads.",
      });
      return false;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const { data: kyc } = await supabase
      .from("kyc_profiles")
      .select("street, city, region, postal_code, country")
      .eq("user_id", userRes.user?.id ?? "")
      .maybeSingle();
    if (!kyc) {
      toast.error("Complete identity verification before issuing a card.");
      return false;
    }
    const k = kyc as Record<string, string>;
    const c = await runIber("Issuing card", () =>
      iberbancoApi.createCard({
        user_number: userNumberRef.current!,
        currency: 1,
        card_type: args?.type || "virtual",
        shipping_address: k.street,
        shipping_city: k.city,
        shipping_state: k.region,
        shipping_country_code: k.country || "US",
        shipping_post_code: k.postal_code,
        delivery_method: "Standard",
      }),
    );
    if (!c) return false;
    void raiseNotification({
      type: "card",
      title: "Card issued",
      body: `Your new ${args?.type || "virtual"} card is ready.`,
      dedupe_key: `card-issued:${c.remote_id}`,
    });
    await refreshColumn({ silent: true });
    return true;
  }, [columnLive, refreshColumn]);

  const setTransactionCategory = useCallback(async (id: string, category: string) => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const { setCategoryOverride } = await import("@/lib/categorize");
    const { error } = await setCategoryOverride(uid, id, category);
    if (error) { toast.error("Couldn't save category", { description: error }); return; }
    dispatch({ type: "SET_TX_CATEGORY", id, category });
    toast.success(`Categorised as ${category}`);
  }, []);

  void CURRENCY_LABEL;

  const { checking, savings } = state.accounts;
  const totalBalance =
    dataStatus === "loaded" && checking
      ? checking.availableBalance + (savings?.availableBalance ?? 0)
      : null;

  const value: Ctx = {
    accounts: state.accounts,
    transactions: state.transactions,
    card: state.card,
    totalBalance,
    dataStatus,
    dataError,
    columnLive,
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
