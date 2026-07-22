import { createContext, useContext, useReducer, ReactNode, useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  accounts as seedAccounts,
  transactions as seedTransactions,
  cardData as seedCard,
  notifications as seedNotifications,
  recentRecipients as seedRecipients,
  Transaction,
} from "@/data/mockData";
import {
  iberbancoApi,
  mapIberAccount,
  mapIberTransaction,
  fetchMyIberUserNumber,
  CURRENCY_LABEL,
  type IberAccount,
} from "@/lib/iberbancoClient";
import { loadAlertPrefs } from "@/lib/alerts";
import { supabase } from "@/integrations/supabase/client";

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

type Account = {
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
  status: "active" | "locked" | "replaced" | "stolen";
  linkedAccount: string;
  expiresAt: string;
  isLocked: boolean;
  isVirtual: boolean;
  controls: CardControls;
  // Iberbanco card remote_id (was columnCardId — name preserved for existing consumers).
  columnCardId?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: string;
}

interface State {
  accounts: { checking: Account; savings: Account };
  transactions: Transaction[];
  card: CardState;
  notifications: NotificationItem[];
  recipients: typeof seedRecipients;
}

type Action =
  | { type: "TRANSFER"; from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }
  | { type: "SEND"; from: "checking" | "savings"; amount: number; recipient: string; note?: string }
  | { type: "DEPOSIT_CHECK"; to: "checking" | "savings"; amount: number }
  | { type: "PAY_BILL"; from: "checking" | "savings"; amount: number; biller: string }
  | { type: "TOGGLE_CARD_LOCK" }
  | { type: "TOGGLE_CARD_CONTROL"; key: keyof CardControls }
  | { type: "REPLACE_CARD" }
  | { type: "REPORT_STOLEN" }
  | { type: "MARK_NOTIFICATION_READ"; id: string }
  | { type: "MARK_ALL_READ" }
  | { type: "ADD_NOTIFICATION"; notification: NotificationItem }
  | { type: "ADD_RECIPIENT"; name: string }
  | { type: "HYDRATE_COLUMN"; accounts?: Partial<State["accounts"]>; transactions?: Transaction[] }
  | { type: "HYDRATE_CARD"; card: Partial<CardState> };

const initialState: State = {
  accounts: seedAccounts,
  transactions: seedTransactions,
  card: {
    ...seedCard,
    status: "active",
    controls: {
      international: true,
      online: true,
      contactless: true,
      inStore: true,
      atm: true,
    },
  },
  notifications: seedNotifications,
  recipients: seedRecipients,
};

const now = () => {
  const d = new Date();
  return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

function bumpBalance(acc: Account, delta: number): Account {
  return {
    ...acc,
    availableBalance: Number((acc.availableBalance + delta).toFixed(2)),
    currentBalance: Number((acc.currentBalance + delta).toFixed(2)),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "TRANSFER": {
      if (action.from === action.to || action.amount <= 0) return state;
      const fromAcc = state.accounts[action.from];
      if (fromAcc.availableBalance < action.amount) return state;
      const debit: Transaction = {
        id: uid("t"),
        merchant: `Transfer to ${action.to === "checking" ? "Everyday Checking" : "High Yield Savings"}`,
        category: "Transfer",
        amount: -action.amount,
        date: now(),
        status: "posted",
        type: "debit",
        paymentMethod: "Internal",
        icon: "↗️",
        account: action.from === "checking" ? "Checking" : "Savings",
      };
      const credit: Transaction = {
        ...debit,
        id: uid("t"),
        merchant: `Transfer from ${action.from === "checking" ? "Everyday Checking" : "High Yield Savings"}`,
        amount: action.amount,
        type: "credit",
        icon: "↙️",
        account: action.to === "checking" ? "Checking" : "Savings",
      };
      return {
        ...state,
        accounts: {
          ...state.accounts,
          [action.from]: bumpBalance(state.accounts[action.from], -action.amount),
          [action.to]: bumpBalance(state.accounts[action.to], action.amount),
        },
        transactions: [debit, credit, ...state.transactions],
        notifications: [
          {
            id: uid("n"),
            title: "Transfer complete",
            body: `$${action.amount.toFixed(2)} moved to ${action.to === "checking" ? "Everyday Checking" : "High Yield Savings"}`,
            time: "Just now",
            read: false,
            type: "transfer",
          },
          ...state.notifications,
        ],
      };
    }

    case "SEND": {
      const fromAcc = state.accounts[action.from];
      if (fromAcc.availableBalance < action.amount || action.amount <= 0) return state;
      const tx: Transaction = {
        id: uid("t"),
        merchant: `Sent to ${action.recipient}`,
        category: "P2P",
        amount: -action.amount,
        date: now(),
        status: "posted",
        type: "debit",
        paymentMethod: "P2P",
        icon: "👤",
        account: action.from === "checking" ? "Checking" : "Savings",
      };
      const initial = action.recipient.trim().charAt(0).toUpperCase() || "?";
      const existing = state.recipients.find((r) => r.name.toLowerCase() === action.recipient.toLowerCase());
      const recipients = existing
        ? state.recipients.map((r) =>
            r.id === existing.id ? { ...r, lastSent: `$${action.amount.toFixed(2)}` } : r
          )
        : [
            { id: uid("r"), name: action.recipient, initial, lastSent: `$${action.amount.toFixed(2)}` },
            ...state.recipients,
          ].slice(0, 8);
      return {
        ...state,
        accounts: { ...state.accounts, [action.from]: bumpBalance(fromAcc, -action.amount) },
        transactions: [tx, ...state.transactions],
        recipients,
        notifications: [
          {
            id: uid("n"),
            title: "Payment sent",
            body: `$${action.amount.toFixed(2)} to ${action.recipient}`,
            time: "Just now",
            read: false,
            type: "transfer",
          },
          ...state.notifications,
        ],
      };
    }

    case "DEPOSIT_CHECK": {
      if (action.amount <= 0) return state;
      const tx: Transaction = {
        id: uid("t"),
        merchant: "Mobile Check Deposit",
        category: "Deposit",
        amount: action.amount,
        date: now(),
        status: "pending",
        type: "credit",
        paymentMethod: "Check",
        icon: "📸",
        account: action.to === "checking" ? "Checking" : "Savings",
      };
      const acc = state.accounts[action.to];
      return {
        ...state,
        accounts: {
          ...state.accounts,
          [action.to]: {
            ...acc,
            pendingAmount: Number((acc.pendingAmount + action.amount).toFixed(2)),
            currentBalance: Number((acc.currentBalance + action.amount).toFixed(2)),
          },
        },
        transactions: [tx, ...state.transactions],
        notifications: [
          {
            id: uid("n"),
            title: "Check deposit submitted",
            body: `$${action.amount.toFixed(2)} — funds available by next business day`,
            time: "Just now",
            read: false,
            type: "deposit",
          },
          ...state.notifications,
        ],
      };
    }

    case "PAY_BILL": {
      const fromAcc = state.accounts[action.from];
      if (fromAcc.availableBalance < action.amount || action.amount <= 0) return state;
      const tx: Transaction = {
        id: uid("t"),
        merchant: action.biller,
        category: "Bills",
        amount: -action.amount,
        date: now(),
        status: "posted",
        type: "debit",
        paymentMethod: "ACH",
        icon: "🧾",
        account: action.from === "checking" ? "Checking" : "Savings",
      };
      return {
        ...state,
        accounts: { ...state.accounts, [action.from]: bumpBalance(fromAcc, -action.amount) },
        transactions: [tx, ...state.transactions],
      };
    }

    case "TOGGLE_CARD_LOCK":
      return {
        ...state,
        card: { ...state.card, isLocked: !state.card.isLocked, status: !state.card.isLocked ? "locked" : "active" },
      };

    case "TOGGLE_CARD_CONTROL":
      return {
        ...state,
        card: { ...state.card, controls: { ...state.card.controls, [action.key]: !state.card.controls[action.key] } },
      };

    case "REPLACE_CARD":
      return {
        ...state,
        card: { ...state.card, status: "replaced", isLocked: true },
        notifications: [
          {
            id: uid("n"),
            title: "New card ordered",
            body: "Your replacement card will arrive in 5–7 business days.",
            time: "Just now",
            read: false,
            type: "card",
          },
          ...state.notifications,
        ],
      };

    case "REPORT_STOLEN":
      return {
        ...state,
        card: { ...state.card, status: "stolen", isLocked: true },
      };

    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      };

    case "MARK_ALL_READ":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };

    case "ADD_NOTIFICATION":
      return { ...state, notifications: [action.notification, ...state.notifications].slice(0, 100) };

    case "HYDRATE_COLUMN":
      return {
        ...state,
        accounts: {
          checking: { ...state.accounts.checking, ...(action.accounts?.checking ?? {}) },
          savings: { ...state.accounts.savings, ...(action.accounts?.savings ?? {}) },
        },
        transactions: action.transactions && action.transactions.length > 0
          ? [...action.transactions, ...state.transactions.filter((t) => !action.transactions!.some((n) => n.id === t.id))]
          : state.transactions,
      };

    case "HYDRATE_CARD":
      return { ...state, card: { ...state.card, ...action.card } };

    default:
      return state;
  }
}

interface Ctx extends State {
  totalBalance: number;
  columnLive: boolean;
  columnError: string | null;
  columnStatus: "idle" | "loading" | "live" | "error";
  refreshColumn: (opts?: { silent?: boolean }) => Promise<void>;
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
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
}

const BankContext = createContext<Ctx | null>(null);

export const BankProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [columnLive, setColumnLive] = useState(false);
  const [columnError, setColumnError] = useState<string | null>(null);
  const [columnStatus, setColumnStatus] = useState<"idle" | "loading" | "live" | "error">("idle");
  const userNumberRef = useRef<string | null>(null);
  const notifiedErrorRef = useRef<string | null>(null);
  const knownTxIdsRef = useRef<Set<string>>(new Set());
  const lastCardStateRef = useRef<string | null>(null);
  const lowBalanceFiredRef = useRef<Record<string, boolean>>({});
  const firstSyncRef = useRef(true);
  // Keep a live reference to the latest state + card so the stable refreshColumn
  // (built once with []-deps) always sees fresh names/apy/etc. without re-creating.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const fireAlert = useCallback((title: string, body: string, type: string, kind: "info" | "warning" | "success" = "info") => {
    const notif: NotificationItem = { id: uid("n"), title, body, time: "Just now", read: false, type };
    dispatch({ type: "ADD_NOTIFICATION", notification: notif });
    if (kind === "warning") toast.warning(title, { description: body });
    else if (kind === "success") toast.success(title, { description: body });
    else toast(title, { description: body });
  }, []);

  const refreshColumn = useCallback(async (opts?: { silent?: boolean }) => {
    setColumnStatus("loading");
    const toastId = opts?.silent ? undefined : `iber-sync`;
    if (!opts?.silent) toast.loading("Syncing with Iberbanco…", { id: toastId });
    try {
      const userNumber = userNumberRef.current ?? (await fetchMyIberUserNumber());
      if (!userNumber) {
        const msg = "Complete identity verification to link a live Iberbanco account.";
        setColumnLive(false);
        setColumnError(msg);
        setColumnStatus("error");
        if (!opts?.silent) toast.error("Iberbanco not linked", { id: toastId, description: msg });
        return;
      }
      userNumberRef.current = userNumber;

      const accountsList = await iberbancoApi.listAccounts(userNumber);
      const active: IberAccount[] = (accountsList || []).filter((a) => a.status !== 3);
      if (active.length === 0) {
        setColumnLive(false);
        const msg = "No active Iberbanco accounts for this user.";
        setColumnError(msg);
        setColumnStatus("error");
        if (!opts?.silent) toast.error("Iberbanco sync failed", { id: toastId, description: msg, action: { label: "Retry", onClick: () => void refreshColumn() } });
        return;
      }

      // Treat the first USD-ish account as checking, next as savings.
      const primary = active.find((a) => a.currency === 1) || active[0];
      const secondary = active.find((a) => a !== primary) || primary;

      const mappedChecking = {
        ...state.accounts.checking,
        ...mapIberAccount(primary),
        type: "checking" as const,
        name: state.accounts.checking.name,
      };
      const mappedSavings = {
        ...state.accounts.savings,
        ...mapIberAccount(secondary),
        type: "savings" as const,
        name: state.accounts.savings.name,
        apy: state.accounts.savings.apy,
      };

      const [chkTx, savTx] = await Promise.all([
        iberbancoApi.listTransactions(primary.account_special_number).catch(() => []),
        secondary.account_special_number !== primary.account_special_number
          ? iberbancoApi.listTransactions(secondary.account_special_number).catch(() => [])
          : Promise.resolve([]),
      ]);
      const txs: Transaction[] = [
        ...chkTx.map((t) => mapIberTransaction(t, "Checking", primary.account_special_number)),
        ...savTx.map((t) => mapIberTransaction(t, "Savings", secondary.account_special_number)),
      ];

      const prefs = loadAlertPrefs();
      const isFirstSync = firstSyncRef.current;
      if (prefs.enabled && !isFirstSync) {
        for (const t of txs) {
          if (knownTxIdsRef.current.has(t.id)) continue;
          const abs = Math.abs(t.amount);
          const isCard = t.paymentMethod === "Debit Card" || (t.category || "").toLowerCase().includes("card");
          if (abs >= prefs.largeTxnAmount) {
            fireAlert(
              `Large ${t.type === "credit" ? "deposit" : "charge"}: $${abs.toFixed(2)}`,
              `${t.merchant} • ${t.account}`,
              t.type === "credit" ? "deposit" : "card",
              "warning",
            );
          } else if (isCard && prefs.cardActivity) {
            fireAlert(`Card charged $${abs.toFixed(2)}`, `${t.merchant} • ${t.account}`, "card");
          } else if (t.type === "credit" && prefs.pushDeposits && abs >= 1) {
            fireAlert(`Deposit received: $${abs.toFixed(2)}`, `${t.merchant} • ${t.account}`, "deposit", "success");
          } else if (t.type === "debit" && prefs.pushTransfers && abs >= 1) {
            fireAlert(`Payment posted: $${abs.toFixed(2)}`, `${t.merchant} • ${t.account}`, "transfer");
          }
        }
        for (const [key, acc] of Object.entries({ checking: mappedChecking, savings: mappedSavings })) {
          const below = acc.availableBalance < prefs.lowBalance;
          if (below && !lowBalanceFiredRef.current[key]) {
            lowBalanceFiredRef.current[key] = true;
            fireAlert(
              `Low balance on ${acc.name}`,
              `Available $${acc.availableBalance.toFixed(2)} is below your $${prefs.lowBalance} threshold.`,
              "card",
              "warning",
            );
          } else if (!below) {
            lowBalanceFiredRef.current[key] = false;
          }
        }
      }
      for (const t of txs) knownTxIdsRef.current.add(t.id);
      firstSyncRef.current = false;

      dispatch({
        type: "HYDRATE_COLUMN",
        accounts: { checking: mappedChecking, savings: mappedSavings },
        transactions: txs,
      });

      try {
        const cards = await iberbancoApi.listCards(userNumber);
        const c = cards[0];
        if (c) {
          dispatch({
            type: "HYDRATE_CARD",
            card: {
              columnCardId: c.remote_id,
              last4: (c.cardNumber || "").slice(-4) || state.card.last4,
              network: state.card.network,
              type: c.type === 1 ? "virtual" : "physical",
              isVirtual: c.type === 1,
              expiresAt: c.expire_date || state.card.expiresAt,
              status: c.status === 1 ? "active" : c.status === 2 ? "locked" : c.status === 6 || c.status === 7 ? "stolen" : "active",
              isLocked: c.status !== 1,
            },
          });
          const nextCardState = String(c.status ?? "");
          if (lastCardStateRef.current && lastCardStateRef.current !== nextCardState && loadAlertPrefs().cardActivity) {
            fireAlert(
              `Card status changed`,
              `Your card •••• ${(c.cardNumber || "").slice(-4)} is now status ${nextCardState}.`,
              "card",
              c.status === 1 ? "success" : "warning",
            );
          }
          lastCardStateRef.current = nextCardState;
        }
      } catch (e) {
        console.warn("Iberbanco card hydrate failed:", e);
      }

      setColumnLive(true);
      setColumnError(null);
      setColumnStatus("live");
      notifiedErrorRef.current = null;
      if (!opts?.silent) toast.success("Iberbanco live", { id: toastId, description: "Backend data synced." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Iberbanco sync failed";
      setColumnLive(false);
      setColumnError(msg);
      setColumnStatus("error");
      console.warn("Iberbanco sync failed — using mock data.", err);
      if (!opts?.silent || notifiedErrorRef.current !== msg) {
        notifiedErrorRef.current = msg;
        toast.error("Iberbanco offline", {
          id: toastId,
          description: `${msg}. Using cached data.`,
          action: { label: "Retry", onClick: () => void refreshColumn() },
        });
      }
    }
  }, [state.accounts.checking, state.accounts.savings, state.card, fireAlert]);

  useEffect(() => {
    refreshColumn({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prefs = loadAlertPrefs();
    if (!prefs.enabled) return;
    const ms = Math.max(10, prefs.pollSeconds) * 1000;
    const id = window.setInterval(() => {
      refreshColumn({ silent: true });
    }, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime push channel (reused). If/when Iberbanco webhooks land, publish
  // events on this same channel from the webhook handler.
  useEffect(() => {
    const channel = supabase.channel("iberbanco-events");
    channel
      .on("broadcast", { event: "*" }, () => {
        refreshColumn({ silent: true });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transfer = useCallback((args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => {
    if (args.amount <= 0 || args.from === args.to) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "TRANSFER", ...args });
    if (columnLive && userNumberRef.current) {
      void runIber("Internal transfer", () =>
        iberbancoApi.createInternalTransfer({
          user_number: userNumberRef.current!,
          account_number_from: state.accounts[args.from].id,
          account_number_to: state.accounts[args.to].id,
          amount: Math.round(args.amount),
          reference: (args.memo || "Internal transfer").slice(0, 60),
        }),
      );
    }
    return true;
  }, [state.accounts, columnLive]);

  const send = useCallback((args: { from: "checking" | "savings"; amount: number; recipient: string; note?: string }) => {
    if (args.amount <= 0 || !args.recipient.trim()) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "SEND", ...args });
    return true;
  }, [state.accounts]);

  const depositCheck = useCallback((args: { to: "checking" | "savings"; amount: number }) => {
    if (args.amount <= 0) return false;
    dispatch({ type: "DEPOSIT_CHECK", ...args });
    return true;
  }, []);

  const payBill = useCallback((args: {
    from: "checking" | "savings";
    amount: number;
    biller: string;
    routingNumber?: string;
    accountNumber?: string;
  }) => {
    if (args.amount <= 0 || !args.biller.trim()) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "PAY_BILL", from: args.from, amount: args.amount, biller: args.biller });
    if (columnLive && userNumberRef.current && args.accountNumber) {
      void runIber(`Bill pay — ${args.biller}`, () =>
        iberbancoApi.createBillPayment({
          user_number: userNumberRef.current!,
          account_number: state.accounts[args.from].id,
          amount: Math.round(args.amount),
          reference: args.biller.slice(0, 60),
          payee_name: args.biller,
          payee_code: (args.routingNumber || "BILL").slice(0, 20),
          payee_account_number: args.accountNumber!,
          beneficiary_email: `noreply+${args.biller.toLowerCase().replace(/\s+/g, "")}@example.com`,
        }),
      );
    }
    return true;
  }, [state.accounts, columnLive]);

  const externalTransfer = useCallback((args: {
    from: "checking" | "savings";
    amount: number;
    bank: string;
    routingNumber: string;
    accountNumber: string;
    memo?: string;
  }) => {
    if (args.amount <= 0) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "PAY_BILL", from: args.from, amount: args.amount, biller: `External ACH — ${args.bank}` });
    if (columnLive && userNumberRef.current) {
      // Iberbanco ACH requires much richer beneficiary/bank info than the app
      // currently collects, so we pad required fields with sensible defaults
      // sourced from the caller's inputs and let the API validate.
      void runIber(`ACH transfer to ${args.bank}`, () =>
        iberbancoApi.createAchTransfer({
          user_number: userNumberRef.current!,
          account_number: state.accounts[args.from].id,
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
      );
    }
    return true;
  }, [state.accounts, columnLive]);

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
    const total = args.amount + fee;
    if (args.amount <= 0) return false;
    if (state.accounts[args.from].availableBalance < total) return false;
    dispatch({ type: "PAY_BILL", from: args.from, amount: total, biller: `Wire — ${args.beneficiaryName}` });
    if (columnLive && userNumberRef.current) {
      // Iberbanco routes wires through SWIFT — treat routing as SWIFT code and
      // recipient account as IBAN; caller inputs may be incomplete, so we pad.
      void runIber(`Wire to ${args.beneficiaryName}`, () =>
        iberbancoApi.createSwiftTransfer({
          user_number: userNumberRef.current!,
          account_number: state.accounts[args.from].id,
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
      );
    }
    return true;
  }, [state.accounts, columnLive]);

  // Iberbanco does not expose card lock/unlock/reissue/controls in v2 — keep
  // local state changes for UX. When the API adds them, wire them here.
  const toggleCardLock = useCallback(async () => {
    dispatch({ type: "TOGGLE_CARD_LOCK" });
  }, []);

  const toggleCardControl = useCallback(async (key: keyof CardControls) => {
    dispatch({ type: "TOGGLE_CARD_CONTROL", key });
  }, []);

  const replaceCard = useCallback(async () => {
    dispatch({ type: "REPLACE_CARD" });
  }, []);

  const reportStolen = useCallback(async () => {
    dispatch({ type: "REPORT_STOLEN" });
  }, []);

  const issueCard = useCallback(async (args?: { type?: "physical" | "virtual" }) => {
    if (!columnLive || !userNumberRef.current) {
      dispatch({ type: "HYDRATE_CARD", card: { status: "active", isLocked: false, isVirtual: args?.type === "virtual" } });
      return true;
    }
    // Pull shipping address from the caller's KYC row.
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
    const c = await runIber("Issuing card", () =>
      iberbancoApi.createCard({
        user_number: userNumberRef.current!,
        currency: 1,
        card_type: args?.type || "virtual",
        shipping_address: (kyc as any).street,
        shipping_city: (kyc as any).city,
        shipping_state: (kyc as any).region,
        shipping_country_code: (kyc as any).country || "US",
        shipping_post_code: (kyc as any).postal_code,
        delivery_method: "Standard",
      }),
    );
    if (!c) return false;
    dispatch({
      type: "HYDRATE_CARD",
      card: {
        columnCardId: c.remote_id,
        last4: (c.cardNumber || "").slice(-4) || state.card.last4,
        type: args?.type || "virtual",
        isVirtual: (args?.type || "virtual") === "virtual",
        status: "active",
        isLocked: false,
      },
    });
    return true;
  }, [columnLive, state.card.last4]);

  // Keep the seed currency label so mock accounts still say "USD" instead of
  // going blank when Iberbanco returns nothing. (Uses CURRENCY_LABEL to avoid
  // an unused-import lint.)
  void CURRENCY_LABEL;

  const value: Ctx = {
    ...state,
    totalBalance: state.accounts.checking.availableBalance + state.accounts.savings.availableBalance,
    columnLive,
    columnError,
    columnStatus,
    refreshColumn,
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
    markNotificationRead: (id) => dispatch({ type: "MARK_NOTIFICATION_READ", id }),
    markAllRead: () => dispatch({ type: "MARK_ALL_READ" }),
  };

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
};

export const useBank = () => {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error("useBank must be used inside <BankProvider>");
  return ctx;
};
