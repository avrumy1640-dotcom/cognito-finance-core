import { createContext, useContext, useReducer, ReactNode, useCallback } from "react";
import {
  accounts as seedAccounts,
  transactions as seedTransactions,
  cardData as seedCard,
  notifications as seedNotifications,
  recentRecipients as seedRecipients,
  Transaction,
} from "@/data/mockData";

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
  | { type: "ADD_RECIPIENT"; name: string };

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

    default:
      return state;
  }
}

interface Ctx extends State {
  totalBalance: number;
  transfer: (args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => boolean;
  send: (args: { from: "checking" | "savings"; amount: number; recipient: string; note?: string }) => boolean;
  depositCheck: (args: { to: "checking" | "savings"; amount: number }) => boolean;
  payBill: (args: { from: "checking" | "savings"; amount: number; biller: string }) => boolean;
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

  const transfer = useCallback((args: { from: "checking" | "savings"; to: "checking" | "savings"; amount: number; memo?: string }) => {
    if (args.amount <= 0 || args.from === args.to) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "TRANSFER", ...args });
    return true;
  }, [state.accounts]);

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

  const payBill = useCallback((args: { from: "checking" | "savings"; amount: number; biller: string }) => {
    if (args.amount <= 0 || !args.biller.trim()) return false;
    if (state.accounts[args.from].availableBalance < args.amount) return false;
    dispatch({ type: "PAY_BILL", ...args });
    return true;
  }, [state.accounts]);

  const value: Ctx = {
    ...state,
    totalBalance: state.accounts.checking.availableBalance + state.accounts.savings.availableBalance,
    transfer,
    send,
    depositCheck,
    payBill,
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
