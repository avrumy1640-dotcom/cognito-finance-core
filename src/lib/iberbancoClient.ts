// Client wrapper around the `iberbanco-proxy` edge function.
// Keeps agent credentials + hash computation server-side.
import { supabase } from "@/integrations/supabase/client";

// Iberbanco account object (subset we consume).
export interface IberAccount {
  account_holder_name?: string;
  account_special_number: string;
  currency: number;
  balance: number | string;
  block_amount?: number | string;
  pending_outgoing_transactions_sum?: number | string;
  pending_incoming_transactions_sum?: number | string;
  available_balance?: number | string;
  status?: number;
  main_iban?: string | null;
  reference?: string | null;
  user?: { user_number?: string; first_name?: string; last_name?: string; email?: string };
}

// Iberbanco transaction resource.
export interface IberTransaction {
  transaction_number: string;
  amount: number | string;
  balance?: number | string;
  type: number;
  status: number;
  created_at: string;
  reference?: string;
  direction: 1 | 2; // 1 = outgoing, 2 = incoming (per docs)
  recipient?: string;
  recipient_details?: { name?: string; account?: string; bank?: string } | null;
  sender_details?: { name?: string; account?: string; bank?: string } | null;
  from_account?: { account_special_number?: string; currency?: number };
  to_account?: { account_special_number?: string; currency?: number };
}

export interface IberCard {
  card_holder_name?: string;
  cardNumber?: string;
  balance?: string | number;
  currency?: number;
  remote_id: string;
  san?: string;
  expire_date?: string; // MM/YY
  status?: number; // 1=Activated, 2=Hold, 6=Lost, 7=Stolen…
  type?: number; // 1=Virtual, 2=PhysicalRequested, 4=Physical
}

interface CallArgs {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

async function call<T>({ path, method = "GET", body, query }: CallArgs): Promise<T> {
  const qs: Record<string, string | number> = {};
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs[k] = v as string | number;
  const { data, error } = await supabase.functions.invoke("iberbanco-proxy", {
    body: { path, method, body, query: qs },
  });
  if (error) throw new Error(error.message || "Iberbanco proxy failed");
  const envelope = data as { status?: string; message?: string; data?: unknown; errors?: unknown };
  if (envelope && envelope.status === "error") {
    throw new Error(envelope.message || "Iberbanco API error");
  }
  return (envelope?.data ?? data) as T;
}

const num = (v: unknown): number => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

export const iberbancoApi = {
  listAccounts: (user_number?: string) =>
    call<IberAccount[]>({ path: "/accounts", query: { user_number, per_page: 100 } }),

  listTransactions: (account_number?: string, from_date?: string, to_date?: string) => {
    if (!account_number) return Promise.resolve([] as IberTransaction[]);
    const today = new Date();
    const to = to_date || today.toISOString().slice(0, 10);
    const from = from_date || new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return call<IberTransaction[]>({
      path: "/transactions",
      query: {
        account_number,
        from_date: from,
        to_date: to,
        per_page: 100,
        sort_by: "created_at",
        sort_order: "desc",
      },
    }).catch(() => [] as IberTransaction[]);
  },

  // Internal transfer between two of the user's accounts.
  createInternalTransfer: (args: {
    user_number: string;
    account_number_from: string;
    account_number_to: string;
    amount: number; // whole units
    reference: string;
    purpose?: string;
  }) =>
    call<unknown>({
      path: "/transactions/INTERNAL",
      method: "POST",
      body: args,
    }),

  createAchTransfer: (args: {
    user_number: string;
    account_number: string;
    amount: number;
    reference: string;
    beneficiary_name: string;
    beneficiary_address: string;
    beneficiary_email: string;
    bank_name: string;
    bank_country: string;
    bank_address: string;
    beneficiary_account_number: string;
    institution_number: string;
    transit_number: string;
  }) => call<unknown>({ path: "/transactions/ACH", method: "POST", body: args }),

  createSwiftTransfer: (args: {
    user_number: string;
    account_number: string;
    amount: number;
    reference: string;
    iban_code: string;
    beneficiary_name: string;
    beneficiary_country: string;
    beneficiary_state: string;
    beneficiary_city: string;
    beneficiary_address: string;
    beneficiary_zip_code: string;
    beneficiary_email?: string;
    swift_code: string;
    bank_name: string;
    bank_country: string;
    bank_state: string;
    bank_city: string;
    bank_address: string;
    bank_zip_code: string;
    purpose?: string;
  }) => call<unknown>({ path: "/transactions/SWIFT", method: "POST", body: args }),

  createBillPayment: (args: {
    user_number: string;
    account_number: string;
    amount: number;
    reference: string;
    payee_name: string;
    payee_code: string;
    payee_account_number: string;
    beneficiary_email: string;
  }) => call<unknown>({ path: "/transactions/BILL_PAYMENT", method: "POST", body: args }),

  // Cards
  listCards: (user_number?: string) =>
    call<IberCard[]>({ path: "/cards", query: { user_number } }).catch(() => [] as IberCard[]),
  createCard: (args: {
    user_number: string;
    currency: number; // 1=USD, 2=EUR
    card_type?: "physical" | "virtual";
    shipping_address: string;
    shipping_city: string;
    shipping_state: string;
    shipping_country_code: string; // 2-letter
    shipping_post_code: string;
    delivery_method?: "Standard" | "Registered";
    product_type?: string;
  }) => call<IberCard>({ path: "/cards/create", method: "POST", body: args }),

  // Debit-card / hosted-payment funding via Iberbanco's payment gateway.
  // When the gateway feature is enabled on the agent, the response carries a
  // hosted checkout URL the client must open. If Iberbanco returns an error
  // (feature disabled, unsupported currency, KYC gap) we surface it as-is so
  // the UI can tell the user honestly.
  createGatewayDeposit: (args: {
    user_number: string;
    account_number: string;   // destination account_special_number
    amount: number;           // whole units
    currency: number;         // Iberbanco currency id (1=USD, 2=EUR)
    reference?: string;
    return_url?: string;
  }) => call<{ redirect_url?: string; payment_url?: string; url?: string; status?: string; reference?: string }>({
    path: "/gateway/deposit",
    method: "POST",
    body: args,
  }),
};

// ---- Currency helpers ----
// Iberbanco currency IDs from the spec (partial): 1=USD, 2=EUR, 3=GBP, 4=CHF,
// 5=CAD, 6=AUD, 7=JPY, 8=HKD, 9=SGD, 11=…, 13=USDT.
export const CURRENCY_LABEL: Record<number, string> = {
  1: "USD", 2: "EUR", 3: "GBP", 4: "CHF", 5: "CAD", 6: "AUD", 7: "JPY",
  8: "HKD", 9: "SGD", 11: "USD-COIN", 13: "USDT", 100: "USD-CARD", 101: "EUR-CARD",
};

// ---- Mapping helpers ----------------------------------------------------

const parseAmount = (v: unknown) => Number(num(v).toFixed(2));

export function mapIberAccount(a: IberAccount) {
  const acct = a.account_special_number;
  return {
    id: acct,
    name: a.reference || `${CURRENCY_LABEL[a.currency] ?? "Iber"} Account`,
    accountNumber: acct ? `••••${acct.slice(-4)}` : "••••0000",
    // routingNumber doubles as the primary display "route" for external
    // deposits: IBAN if we have one (SEPA), else fall back to the account
    // reference number itself.
    routingNumber: a.main_iban || acct || "",
    availableBalance: parseAmount(a.available_balance ?? a.balance),
    currentBalance: parseAmount(a.balance),
    pendingAmount: parseAmount(a.pending_incoming_transactions_sum),
    status: a.status === 2 ? "Active" : a.status === 1 ? "Requested" : "Inactive",
    openedDate: "",
    // Real deposit-in details that the receive / add-money screens surface.
    depositDetails: {
      accountNumber: acct || "",          // Iberbanco special number
      iban: a.main_iban || "",             // present for EUR / SEPA accounts
      holderName: a.account_holder_name || `${a.user?.first_name ?? ""} ${a.user?.last_name ?? ""}`.trim(),
      currency: CURRENCY_LABEL[a.currency] ?? "USD",
      reference: acct || "",               // wire memo/reference so funds route back
    },
  };
}


// Iberbanco transaction direction: 1 = outgoing (debit), 2 = incoming (credit).
export function mapIberTransaction(t: IberTransaction, accountLabel: string, myAccountNumber?: string) {
  const isCredit =
    t.direction === 2 ||
    (myAccountNumber ? t.to_account?.account_special_number === myAccountNumber : false);
  const amount = (isCredit ? 1 : -1) * Math.abs(num(t.amount));
  const merchant =
    t.recipient ||
    t.recipient_details?.name ||
    t.sender_details?.name ||
    t.reference ||
    "Iberbanco transaction";
  return {
    id: t.transaction_number,
    merchant,
    category: `Type ${t.type}`,
    amount,
    date: t.created_at,
    // status: 2 = Approved, 1/3 = pending, others treated as pending
    status: (t.status === 2 ? "posted" : "pending") as "posted" | "pending",
    type: (isCredit ? "credit" : "debit") as "credit" | "debit",
    paymentMethod: "Iberbanco",
    icon: isCredit ? "💰" : "💳",
    account: accountLabel,
  };
}

// Look up the calling user's Iberbanco user_number from kyc_profiles.
export async function fetchMyIberUserNumber(): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data } = await supabase
    .from("kyc_profiles")
    .select("iberbanco_user_number")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  return (data as { iberbanco_user_number?: string } | null)?.iberbanco_user_number ?? null;
}
