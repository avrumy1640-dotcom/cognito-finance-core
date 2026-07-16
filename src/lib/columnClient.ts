// Client wrapper around the `column-proxy` edge function.
// Keeps COLUMN_API_KEY server-side; typed helpers map Column entities to app shape.
import { supabase } from "@/integrations/supabase/client";

export interface ColumnBankAccount {
  id: string;
  description?: string;
  type?: string;
  bic?: string;
  routing_number?: string;
  account_number?: string;
  balances?: {
    available_amount?: number;
    holding_amount?: number;
    pending_amount?: number;
    locked_amount?: number;
    posted_balance?: number;
  };
  created_at?: string;
  is_overdraftable?: boolean;
  owners?: string[];
}

export interface ColumnTransaction {
  id: string;
  amount: number; // cents
  description?: string;
  merchant_name?: string;
  posted_at?: string;
  created_at?: string;
  type?: string;
  status?: string;
  bank_account_id?: string;
}

interface ColumnTransfer {
  id: string;
  amount: number; // cents, always positive in Column transfer payloads
  description?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  type?: string;
  status?: string;
  is_incoming?: boolean;
  sender_internal_account?: { bank_account_id?: string; account_number_id?: string };
  receiver_internal_account?: { bank_account_id?: string; account_number_id?: string };
  external_source?: { bank_name?: string; sender_name?: string; counterparty_id?: string };
  external_destination?: { counterparty_id?: string };
}

interface CallArgs {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

async function callColumn<T>({ path, method = "GET", body, query }: CallArgs): Promise<T> {
  const qs: Record<string, string> = {};
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined) qs[k] = String(v);
  const { data, error } = await supabase.functions.invoke("column-proxy", {
    body: { path, method, body, query: qs },
  });
  if (error) throw new Error(error.message || "Column proxy failed");
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    // Column error envelope – rethrow the message
    const msg = (data as { message?: string; error?: string }).message ||
      (data as { error?: string }).error || "Column API error";
    throw new Error(msg);
  }
  return data as T;
}

export const columnApi = {
  listBankAccounts: () =>
    callColumn<{ bank_accounts: ColumnBankAccount[] }>({ path: "/bank-accounts" }),
  listTransactions: (bankAccountId?: string, fromDate?: string, toDate?: string) => {
    if (!bankAccountId) return Promise.resolve({ transactions: [] as ColumnTransaction[] });
    // Column's current public API exposes activity through the unified
    // `/transfers` endpoint. The previous `/transactions/...` paths return 404.
    const today = new Date();
    const to = toDate || today.toISOString().slice(0, 10);
    const from =
      fromDate ||
      new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return callColumn<{ transfers?: ColumnTransfer[] }>({
      path: "/transfers",
      query: {
        bank_account_id: bankAccountId,
        created_at_gte: `${from}T00:00:00Z`,
        created_at_lte: `${to}T23:59:59Z`,
        limit: 100,
        sort_by: "created_at",
        sort_order: "desc",
      },
    })
      .then((d) => ({
        transactions: (d.transfers ?? []).map((transfer) => {
          const isCredit =
            transfer.is_incoming === true ||
            transfer.receiver_internal_account?.bank_account_id === bankAccountId;
          return {
            id: transfer.id,
            amount: (isCredit ? 1 : -1) * Math.abs(transfer.amount),
            description:
              transfer.description ||
              transfer.external_source?.sender_name ||
              transfer.external_source?.bank_name ||
              transfer.type,
            merchant_name: transfer.external_source?.sender_name || transfer.external_source?.bank_name,
            posted_at: transfer.completed_at,
            created_at: transfer.created_at || transfer.updated_at,
            type: transfer.type,
            status: transfer.status === "completed" ? "posted" : transfer.status,
            bank_account_id: bankAccountId,
          } satisfies ColumnTransaction;
        }),
      }))
      // Accounts without transfer activity should render as an empty history.
      .catch(() => ({ transactions: [] as ColumnTransaction[] }));
  },

  createBookTransfer: (args: { sender_bank_account_id: string; receiver_bank_account_id: string; amount: number; description?: string }) =>
    callColumn<unknown>({ path: "/transfers/book", method: "POST", body: args }),
  createCounterparty: (args: {
    routing_number: string;
    account_number: string;
    account_type?: "checking" | "savings";
    description?: string;
    name?: string;
  }) => callColumn<{ id: string }>({ path: "/counterparties", method: "POST", body: args }),
  createAchTransfer: (args: {
    bank_account_id: string;
    counterparty_id: string;
    amount: number;
    type: "credit" | "debit";
    description?: string;
    company_entry_description?: string;
  }) => callColumn<unknown>({ path: "/transfers/ach", method: "POST", body: args }),
  createWireTransfer: (args: {
    bank_account_id: string;
    counterparty_id: string;
    amount: number;
    description?: string;
    beneficiary_message?: string;
  }) => callColumn<unknown>({ path: "/transfers/wire", method: "POST", body: args }),

  // --- Cards ---------------------------------------------------------------
  listCards: (_bankAccountId?: string) =>
    // The connected Column API does not expose a public `/cards` endpoint for
    // this account, so initial sync must not call it and surface a 404 overlay.
    Promise.resolve({ cards: [] as ColumnCard[] }),
  issueCard: (args: {
    bank_account_id: string;
    type?: "physical" | "virtual";
    program_id?: string;
    cardholder?: { first_name?: string; last_name?: string; email?: string };
    shipping_address?: Record<string, string>;
  }) => callColumn<ColumnCard>({ path: "/cards", method: "POST", body: args }),
  lockCard: (cardId: string) =>
    callColumn<ColumnCard>({ path: `/cards/${cardId}/lock`, method: "POST" }),
  unlockCard: (cardId: string) =>
    callColumn<ColumnCard>({ path: `/cards/${cardId}/unlock`, method: "POST" }),
  reissueCard: (cardId: string, reason: "damaged" | "lost" | "stolen" = "damaged") =>
    callColumn<ColumnCard>({
      path: `/cards/${cardId}/reissue`,
      method: "POST",
      body: { reason },
    }),
  updateCardControls: (cardId: string, controls: Record<string, unknown>) =>
    callColumn<ColumnCard>({
      path: `/cards/${cardId}`,
      method: "PATCH",
      body: { merchant_controls: controls },
    }),
};

export interface ColumnCard {
  id: string;
  bank_account_id?: string;
  state?: string; // active | locked | replaced | closed
  type?: string; // physical | virtual
  last_four?: string;
  network?: string;
  expiration_month?: string;
  expiration_year?: string;
  merchant_controls?: Record<string, unknown>;
}


// --- Mapping helpers -------------------------------------------------------

const centsToDollars = (n?: number) => (typeof n === "number" ? Number((n / 100).toFixed(2)) : 0);

export function mapColumnAccount(a: ColumnBankAccount) {
  return {
    id: a.id,
    name: a.description || "Column Account",
    accountNumber: a.account_number ? `••••${a.account_number.slice(-4)}` : "••••0000",
    routingNumber: a.routing_number || "",
    availableBalance: centsToDollars(a.balances?.available_amount),
    currentBalance: centsToDollars(a.balances?.posted_balance ?? a.balances?.available_amount),
    pendingAmount: centsToDollars(a.balances?.pending_amount),
    status: "Active",
    openedDate: a.created_at?.slice(0, 10) || "",
  };
}

export function mapColumnTransaction(t: ColumnTransaction, accountLabel: string) {
  const amount = centsToDollars(t.amount);
  const isCredit = amount > 0;
  return {
    id: t.id,
    merchant: t.merchant_name || t.description || "Column Transaction",
    category: t.type || "Other",
    amount,
    date: t.posted_at || t.created_at || "",
    status: (t.status === "posted" ? "posted" : "pending") as "posted" | "pending",
    type: (isCredit ? "credit" : "debit") as "credit" | "debit",
    paymentMethod: t.type || "ACH",
    icon: isCredit ? "💰" : "💳",
    account: accountLabel,
  };
}
