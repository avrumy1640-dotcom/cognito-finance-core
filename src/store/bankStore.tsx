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
import { columnApi, mapColumnAccount, mapColumnTransaction } from "@/lib/columnClient";
import { loadAlertPrefs } from "@/lib/alerts";

// Wraps a Column API call so the user always sees loading, success, and error
// state with a Retry action instead of a silent console warn.
async function runColumn<T>(label: string, fn: () => Promise<T>, opts?: { silentSuccess?: boolean }): Promise<T | null> {
  const id = `col-${label}-${Date.now()}`;
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
      action: { label: "Retry", onClick: () => void runColumn(label, fn, opts) },
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
  const notifiedErrorRef = useRef<string | null>(null);
  const knownTxIdsRef = useRef<Set<string>>(new Set());
  const lastCardStateRef = useRef<string | null>(null);
  const lowBalanceFiredRef = useRef<Record<string, boolean>>({});
  const firstSyncRef = useRef(true);

  // Emits both a toast and an in-app notification row for real-time alerts.
  const fireAlert = useCallback((title: string, body: string, type: string, kind: "info" | "warning" | "success" = "info") => {
    const notif: NotificationItem = { id: uid("n"), title, body, time: "Just now", read: false, type };
    dispatch({ type: "ADD_NOTIFICATION", notification: notif });
    if (kind === "warning") toast.warning(title, { description: body });
    else if (kind === "success") toast.success(title, { description: body });
    else toast(title, { description: body });
  }, []);
    setColumnStatus("loading");
    const toastId = opts?.silent ? undefined : `col-sync`;
    if (!opts?.silent) toast.loading("Syncing with Column…", { id: toastId });
    try {
      const { bank_accounts } = await columnApi.listBankAccounts();
      if (!bank_accounts || bank_accounts.length === 0) {
        setColumnLive(false);
        const msg = "No Column bank accounts found for this API key.";
        setColumnError(msg);
        setColumnStatus("error");
        if (!opts?.silent) toast.error("Column sync failed", { id: toastId, description: msg, action: { label: "Retry", onClick: () => void refreshColumn() } });
        return;
      }
      const checkingSrc =
        bank_accounts.find((a) => (a.type || "").toLowerCase().includes("checking")) || bank_accounts[0];
      const savingsSrc =
        bank_accounts.find(
          (a) => (a.type || "").toLowerCase().includes("saving") && a.id !== checkingSrc.id
        ) || bank_accounts[1] || checkingSrc;

      const mappedChecking = { ...state.accounts.checking, ...mapColumnAccount(checkingSrc), type: "checking" as const, name: state.accounts.checking.name };
      const mappedSavings = { ...state.accounts.savings, ...mapColumnAccount(savingsSrc), type: "savings" as const, name: state.accounts.savings.name, apy: state.accounts.savings.apy };

      const [chkTx, savTx] = await Promise.all([
        columnApi.listTransactions(checkingSrc.id).catch(() => ({ transactions: [] })),
        savingsSrc.id !== checkingSrc.id
          ? columnApi.listTransactions(savingsSrc.id).catch(() => ({ transactions: [] }))
          : Promise.resolve({ transactions: [] }),
      ]);
      const txs: Transaction[] = [
        ...chkTx.transactions.map((t) => mapColumnTransaction(t, "Checking")),
        ...savTx.transactions.map((t) => mapColumnTransaction(t, "Savings")),
      ];

      dispatch({
        type: "HYDRATE_COLUMN",
        accounts: { checking: mappedChecking, savings: mappedSavings },
        transactions: txs,
      });

      try {
        const { cards } = await columnApi.listCards(checkingSrc.id);
        const c = cards[0];
        if (c) {
          const controlsIn = (c.merchant_controls || {}) as Record<string, boolean | undefined>;
          dispatch({
            type: "HYDRATE_CARD",
            card: {
              columnCardId: c.id,
              last4: c.last_four || state.card.last4,
              network: c.network || state.card.network,
              type: c.type || state.card.type,
              isVirtual: (c.type || "").toLowerCase() === "virtual",
              expiresAt:
                c.expiration_month && c.expiration_year
                  ? `${c.expiration_month}/${String(c.expiration_year).slice(-2)}`
                  : state.card.expiresAt,
              status: c.state === "locked" ? "locked" : c.state === "closed" ? "replaced" : "active",
              isLocked: c.state === "locked" || c.state === "closed",
              controls: {
                international: controlsIn.international ?? state.card.controls.international,
                online: controlsIn.online ?? state.card.controls.online,
                contactless: controlsIn.contactless ?? state.card.controls.contactless,
                inStore: controlsIn.in_store ?? controlsIn.inStore ?? state.card.controls.inStore,
                atm: controlsIn.atm ?? state.card.controls.atm,
              },
            },
          });
        }
      } catch (e) {
        console.warn("Column card hydrate failed:", e);
      }

      setColumnLive(true);
      setColumnError(null);
      setColumnStatus("live");
      notifiedErrorRef.current = null;
      if (!opts?.silent) toast.success("Column live", { id: toastId, description: "Backend data synced." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Column sync failed";
      setColumnLive(false);
      setColumnError(msg);
      setColumnStatus("error");
      console.warn("Column sync failed — using mock data.", err);
      if (!opts?.silent || notifiedErrorRef.current !== msg) {
        notifiedErrorRef.current = msg;
        toast.error("Column offline", {
          id: toastId,
          description: `${msg}. Using cached data.`,
          action: { label: "Retry", onClick: () => void refreshColumn() },
        });
      }
    }
  }, [state.accounts.checking, state.accounts.savings, state.card]);

  useEffect(() => {
    // Silent initial sync — fall back to seed data without a noisy toast.
    refreshColumn({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transfer = useCallback((args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => {
    if (args.amount <= 0 || args.from === args.to) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "TRANSFER", ...args });
    if (columnLive) {
      const sender = state.accounts[args.from].id;
      const receiver = state.accounts[args.to].id;
      void runColumn("Internal transfer", () =>
        columnApi.createBookTransfer({
          sender_bank_account_id: sender,
          receiver_bank_account_id: receiver,
          amount: Math.round(args.amount * 100),
          description: args.memo || "Internal transfer",
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
    if (columnLive && args.routingNumber && args.accountNumber) {
      void runColumn(`Bill pay — ${args.biller}`, async () => {
        const cp = await columnApi.createCounterparty({
          routing_number: args.routingNumber!,
          account_number: args.accountNumber!,
          account_type: "checking",
          description: args.biller,
          name: args.biller,
        });
        return columnApi.createAchTransfer({
          bank_account_id: state.accounts[args.from].id,
          counterparty_id: cp.id,
          amount: Math.round(args.amount * 100),
          type: "credit",
          description: args.biller.slice(0, 80),
          company_entry_description: "BILLPAY",
        });
      });
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
    if (columnLive) {
      void runColumn(`ACH transfer to ${args.bank}`, async () => {
        const cp = await columnApi.createCounterparty({
          routing_number: args.routingNumber,
          account_number: args.accountNumber,
          account_type: "checking",
          description: args.bank,
          name: args.bank,
        });
        return columnApi.createAchTransfer({
          bank_account_id: state.accounts[args.from].id,
          counterparty_id: cp.id,
          amount: Math.round(args.amount * 100),
          type: "credit",
          description: (args.memo || args.bank).slice(0, 80),
          company_entry_description: "TRANSFER",
        });
      });
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
    if (columnLive) {
      void runColumn(`Wire to ${args.beneficiaryName}`, async () => {
        const cp = await columnApi.createCounterparty({
          routing_number: args.routingNumber,
          account_number: args.accountNumber,
          account_type: "checking",
          description: args.beneficiaryName,
          name: args.beneficiaryName,
        });
        return columnApi.createWireTransfer({
          bank_account_id: state.accounts[args.from].id,
          counterparty_id: cp.id,
          amount: Math.round(args.amount * 100),
          description: (args.memo || args.beneficiaryName).slice(0, 80),
        });
      });
    }
    return true;
  }, [state.accounts, columnLive]);

  const toggleCardLock = useCallback(async () => {
    const willLock = !state.card.isLocked;
    dispatch({ type: "TOGGLE_CARD_LOCK" });
    if (columnLive && state.card.columnCardId) {
      await runColumn(willLock ? "Locking card" : "Unlocking card", () =>
        willLock ? columnApi.lockCard(state.card.columnCardId!) : columnApi.unlockCard(state.card.columnCardId!),
        { silentSuccess: true },
      );
    }
  }, [state.card.isLocked, state.card.columnCardId, columnLive]);

  const toggleCardControl = useCallback(async (key: keyof CardControls) => {
    dispatch({ type: "TOGGLE_CARD_CONTROL", key });
    if (columnLive && state.card.columnCardId) {
      const next = { ...state.card.controls, [key]: !state.card.controls[key] };
      await runColumn("Updating card controls", () =>
        columnApi.updateCardControls(state.card.columnCardId!, {
          international: next.international,
          online: next.online,
          contactless: next.contactless,
          in_store: next.inStore,
          atm: next.atm,
        }),
        { silentSuccess: true },
      );
    }
  }, [state.card.controls, state.card.columnCardId, columnLive]);

  const replaceCard = useCallback(async () => {
    dispatch({ type: "REPLACE_CARD" });
    if (columnLive && state.card.columnCardId) {
      const c = await runColumn("Reissuing card", () =>
        columnApi.reissueCard(state.card.columnCardId!, "damaged"),
      );
      if (c?.id) dispatch({ type: "HYDRATE_CARD", card: { columnCardId: c.id, last4: c.last_four || state.card.last4 } });
    }
  }, [state.card.columnCardId, state.card.last4, columnLive]);

  const reportStolen = useCallback(async () => {
    dispatch({ type: "REPORT_STOLEN" });
    if (columnLive && state.card.columnCardId) {
      const c = await runColumn("Reporting card stolen", () =>
        columnApi.reissueCard(state.card.columnCardId!, "stolen"),
      );
      if (c?.id) dispatch({ type: "HYDRATE_CARD", card: { columnCardId: c.id, last4: c.last_four || state.card.last4 } });
    }
  }, [state.card.columnCardId, state.card.last4, columnLive]);

  const issueCard = useCallback(async (args?: { type?: "physical" | "virtual" }) => {
    if (!columnLive) {
      dispatch({ type: "HYDRATE_CARD", card: { status: "active", isLocked: false, isVirtual: args?.type === "virtual" } });
      return true;
    }
    const c = await runColumn("Issuing card", () =>
      columnApi.issueCard({
        bank_account_id: state.accounts.checking.id,
        type: args?.type || "virtual",
      }),
    );
    if (!c) return false;
    dispatch({
      type: "HYDRATE_CARD",
      card: {
        columnCardId: c.id,
        last4: c.last_four || state.card.last4,
        network: c.network || state.card.network,
        type: c.type || state.card.type,
        isVirtual: (c.type || "").toLowerCase() === "virtual",
        status: "active",
        isLocked: false,
      },
    });
    return true;
  }, [columnLive, state.accounts.checking.id, state.card.last4, state.card.network, state.card.type]);

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
