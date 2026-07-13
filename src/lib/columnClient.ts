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
  listTransactions: (bankAccountId?: string) =>
    // Column's transaction history lives under /bank-accounts/:id/history.
    bankAccountId
      ? callColumn<{ transactions?: ColumnTransaction[] }>({
          path: `/bank-accounts/${bankAccountId}/history`,
        }).then((d) => ({ transactions: d.transactions ?? [] }))
      : Promise.resolve({ transactions: [] as ColumnTransaction[] }),
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
};

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
