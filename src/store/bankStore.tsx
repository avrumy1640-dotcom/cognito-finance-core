import { createContext, useContext, useReducer, ReactNode, useCallback, useEffect, useState } from "react";
import {
  accounts as seedAccounts,
  transactions as seedTransactions,
  cardData as seedCard,
  notifications as seedNotifications,
  recentRecipients as seedRecipients,
  Transaction,
} from "@/data/mockData";
import { columnApi, mapColumnAccount, mapColumnTransaction } from "@/lib/columnClient";

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
  | { type: "ADD_RECIPIENT"; name: string }
  | { type: "HYDRATE_COLUMN"; accounts?: Partial<State["accounts"]>; transactions?: Transaction[] };

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

    default:
      return state;
  }
}

interface Ctx extends State {
  totalBalance: number;
  columnLive: boolean;
  columnError: string | null;
  refreshColumn: () => Promise<void>;
  transfer: (args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => boolean;
  send: (args: { from: "checking" | "savings"; amount: number; recipient: string; note?: string }) => boolean;
  depositCheck: (args: { to: "checking" | "savings"; amount: number }) => boolean;
  payBill: (args: { from: "checking" | "savings"; amount: number; biller: string; routingNumber?: string; accountNumber?: string }) => boolean;
  externalTransfer: (args: { from: "checking" | "savings"; amount: number; bank: string; routingNumber: string; accountNumber: string; memo?: string }) => boolean;
  wireTransfer: (args: { from: "checking" | "savings"; amount: number; beneficiaryName: string; routingNumber: string; accountNumber: string; memo?: string; fee?: number }) => boolean;
  toggleCardLock: () => void;
  toggleCardControl: (key: keyof CardControls) => void;
  replaceCard: () => void;
  reportStolen: () => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
}

const BankContext = createContext<Ctx | null>(null);

export const BankProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [columnLive, setColumnLive] = useState(false);
  const [columnError, setColumnError] = useState<string | null>(null);

  const refreshColumn = useCallback(async () => {
    try {
      const { bank_accounts } = await columnApi.listBankAccounts();
      if (!bank_accounts || bank_accounts.length === 0) {
        setColumnLive(false);
        setColumnError("No Column bank accounts found for this API key.");
        return;
      }
      // Pick first checking-type + first savings-type; fall back to first two.
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
      setColumnLive(true);
      setColumnError(null);
    } catch (err) {
      setColumnLive(false);
      setColumnError(err instanceof Error ? err.message : "Column sync failed");
      console.warn("Column sync failed — using mock data.", err);
    }
  }, [state.accounts.checking, state.accounts.savings]);

  useEffect(() => {
    // Fire once on mount; store already has mock seed as fallback.
    refreshColumn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transfer = useCallback((args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => {
    if (args.amount <= 0 || args.from === args.to) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "TRANSFER", ...args });
    if (columnLive) {
      const sender = state.accounts[args.from].id;
      const receiver = state.accounts[args.to].id;
      columnApi
        .createBookTransfer({
          sender_bank_account_id: sender,
          receiver_bank_account_id: receiver,
          amount: Math.round(args.amount * 100),
          description: args.memo || "Internal transfer",
        })
        .catch((e) => console.warn("Column book transfer failed:", e));
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
    // When routing/account are provided and Column is live, post a real ACH credit.
    if (columnLive && args.routingNumber && args.accountNumber) {
      (async () => {
        try {
          const cp = await columnApi.createCounterparty({
            routing_number: args.routingNumber!,
            account_number: args.accountNumber!,
            account_type: "checking",
            description: args.biller,
            name: args.biller,
          });
          await columnApi.createAchTransfer({
            bank_account_id: state.accounts[args.from].id,
            counterparty_id: cp.id,
            amount: Math.round(args.amount * 100),
            type: "credit",
            description: args.biller.slice(0, 80),
            company_entry_description: "BILLPAY",
          });
        } catch (e) {
          console.warn("Column bill pay failed:", e);
        }
      })();
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
      (async () => {
        try {
          const cp = await columnApi.createCounterparty({
            routing_number: args.routingNumber,
            account_number: args.accountNumber,
            account_type: "checking",
            description: args.bank,
            name: args.bank,
          });
          await columnApi.createAchTransfer({
            bank_account_id: state.accounts[args.from].id,
            counterparty_id: cp.id,
            amount: Math.round(args.amount * 100),
            type: "credit",
            description: (args.memo || args.bank).slice(0, 80),
            company_entry_description: "TRANSFER",
          });
        } catch (e) {
          console.warn("Column ACH transfer failed:", e);
        }
      })();
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
      (async () => {
        try {
          const cp = await columnApi.createCounterparty({
            routing_number: args.routingNumber,
            account_number: args.accountNumber,
            account_type: "checking",
            description: args.beneficiaryName,
            name: args.beneficiaryName,
          });
          await columnApi.createWireTransfer({
            bank_account_id: state.accounts[args.from].id,
            counterparty_id: cp.id,
            amount: Math.round(args.amount * 100),
            description: (args.memo || args.beneficiaryName).slice(0, 80),
          });
        } catch (e) {
          console.warn("Column wire transfer failed:", e);
        }
      })();
    }
    return true;
  }, [state.accounts, columnLive]);

  const value: Ctx = {
    ...state,
    totalBalance: state.accounts.checking.availableBalance + state.accounts.savings.availableBalance,
    columnLive,
    columnError,
    refreshColumn,
    transfer,
    send,
    depositCheck,
    payBill,
    externalTransfer,
    wireTransfer,
    toggleCardLock: () => dispatch({ type: "TOGGLE_CARD_LOCK" }),
    toggleCardControl: (key) => dispatch({ type: "TOGGLE_CARD_CONTROL", key }),
    replaceCard: () => dispatch({ type: "REPLACE_CARD" }),
    reportStolen: () => dispatch({ type: "REPORT_STOLEN" }),
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
