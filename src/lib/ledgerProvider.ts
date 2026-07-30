// Internal ledger-provider client.
//
// The ONLY client-side entry point to the sandbox banking provider. All calls
// go through the `ledger-sync` edge function; provider name, base URL and API
// key never reach the browser. Response shapes here are deliberately generic
// (accounts / transactions / entity) so devtools reveal nothing about the
// upstream vendor.
import { supabase } from "@/integrations/supabase/client";
import type { DemoAccount, DemoLedger, DemoTransaction } from "@/lib/demoBank";

// There is no mock/demo data source any more. Every session, for every user,
// reads and writes through the banking partner. Promoting the app from the
// sandbox to production is purely a matter of swapping the server-side
// COLUMN_API_KEY from a `test_` key to a `live_` key — no code change here.


/** One human with ownership rights over an account. */
export interface AccountOwner {
  userId: string;
  name: string;
  role: "primary" | "joint";
  isMe: boolean;
}

export interface ProviderAccount {
  id: string;
  name: string;
  type: string;
  accountNumber: string;
  routingNumber: string;
  status: string;
  isOverdrawn: boolean;
  available: number;
  current: number;
  pending: number;
  /** True when more than one entity owns the account at the provider. */
  isJoint?: boolean;
  myRole?: "primary" | "joint";
  owners?: AccountOwner[];
}


export interface ProviderSnapshot {
  provisioned: boolean;
  entity: { entityId: string; verificationStatus: string } | null;
  accounts: ProviderAccount[];
  transactions: Array<Omit<DemoTransaction, "icon">>;
  /** True when more transactions exist beyond the requested window. */
  transactionsHasMore?: boolean;
  transactionsTotal?: number;
  transactionsOffset?: number;
}

/** Paging window for the transaction feed (cursor-free offset over our mirror). */
export interface SyncPage { limit?: number; offset?: number }

/** Error carrying the provider's structured `code` so callers can branch on it. */
export class ProviderError extends Error {
  code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

/**
 * Plain-English copy for the provider error codes a customer can actually
 * trigger. Anything unmapped falls back to the provider's own message.
 */
const FRIENDLY_CODES: Record<string, string> = {
  transfer_non_sufficient_fund: "Not enough money in this account to cover the transfer.",
  entity_not_verified: "Your identity check isn't complete yet, so money can't move.",
  routing_number_not_found: "That routing number doesn't match a US bank. Double-check the 9 digits.",
  bank_account_not_found: "We couldn't find that account. Check the account number and try again.",
  counterparty_not_found: "That recipient no longer exists. Re-enter their bank details.",
  transfer_amount_limit_exceeded: "This amount is over your transfer limit.",
  // Raised by OUR server-side limit engine, which already ships friendly copy
  // naming the exact cap and the remaining allowance — so don't overwrite it.
  invalid_request_error: "Some of the details entered aren't valid. Review the form and try again.",
};

/** User-facing copy for a provider failure. */
export function friendlyProviderMessage(e: unknown): string {
  if (e instanceof ProviderError && e.code && FRIENDLY_CODES[e.code]) return FRIENDLY_CODES[e.code];
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ledger-sync", { body });
  if (error) {
    // Surface the real server-side reason instead of a generic "non-2xx".
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const detail = JSON.parse(await ctx.text()) as { error?: string; code?: string };
        if (detail?.error) throw new ProviderError(detail.error, detail.code ?? null);
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (e instanceof Error && e.message && !/JSON/.test(e.message)) throw e;
      }
    }
    throw new ProviderError(error.message);
  }
  const payload = data as { error?: string; code?: string } | null;
  if (payload?.error) throw new ProviderError(payload.error, payload.code ?? null);
  return data as T;
}

export interface TransferArgs {
  kind: "book" | "ach" | "ach_pull" | "wire";
  amount: number;
  description?: string;
  /** "checking" | "savings" | a provider account id */
  from?: string;
  to?: string;
  name?: string;
  routingNumber?: string;
  accountNumber?: string;
  /**
   * Minted once per user intent (before the first attempt) and reused on
   * retries — the server folds it into the provider Idempotency-Key so a
   * double-tap can never send twice.
   */
  requestId?: string;
  /** Wire only — required for OFAC screening of the beneficiary. */
  beneficiaryLine1?: string;
  beneficiaryCity?: string;
  beneficiaryState?: string;
  beneficiaryPostalCode?: string;
  beneficiaryCountry?: string;
}

/* --------------------------------------------------------------------------
 * Provider enums and admin shapes.
 *
 * `documentType` and `purposes` are FIXED enums on the partner's evidence
 * endpoint — an arbitrary string is rejected, which is how an upload can fail
 * silently. Typing them here makes an invalid value a compile error.
 * ------------------------------------------------------------------------ */
export type ColumnDocumentType =
  | "identity_license" | "identity_passport" | "identity_utility"
  | "bank_statement" | "source_of_funds_document" | "source_of_wealth_document"
  | "complete_customer_file" | "other";

export type ColumnEvidencePurpose =
  | "identity_verification" | "proof_of_address" | "ofac_screening"
  | "pep_screening" | "adverse_media_screening" | "complete_customer_file"
  | "signed_account_agreement" | "attestation_terms_of_service";

/** One required field on the partner's compliance record. */
export interface ComplianceItem {
  field: string;
  /** All four real field statuses — "invalid" is NOT the same as "missing". */
  status: "complete" | "missing" | "invalid" | "pending" | "unknown";
  message?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  enabledEvents: string[];
  isDisabled: boolean;
  createdAt: string | null;
}

export interface WebhookVerifyResult {
  endpointId: string;
  eventType: string;
  statusCode: number | null;
  responseBody: string | null;
  success: boolean | null;
  raw: unknown;
}

export interface WebhookDelivery {
  id: string;
  eventId: string | null;
  eventType: string | null;
  /** The partner reports the outcome as SUCCEEDED / FAILED / PENDING. */
  status: string | null;
  scheduledAt: string | null;
  statusCode: number | null;
  success: boolean | null;
  attempts: number | null;
  error: string | null;
  createdAt: string | null;
  responseBody: string | null;
}

export interface EventReconciliation {
  checked: number;
  recorded: number;
  missingCount: number;
  missing: Array<{ id: string; type: string | null; createdAt: string | null }>;
}


export interface JointOverview {
  incoming: Array<{ id: string; bankAccountId: string; from: string; createdAt: string }>;
  outgoing: Array<{
    id: string; bankAccountId: string; accountName: string; to: string;
    status: string; createdAt: string;
  }>;
  accounts: Array<{
    id: string; name: string; type: string;
    myRole: "primary" | "joint";
    owners: AccountOwner[];
  }>;
}

export const ledgerProvider = {
  status: () => call<{ sandbox: boolean; configured: boolean; entity: unknown }>({ action: "status" }),
  diagnose: () =>
    call<{ configured: boolean; sandbox: boolean; webhookSecret: boolean; reachable: boolean; entityCount?: number; platformId?: string | null; error?: string }>({
      action: "diagnose",
    }),
  /** Creates the sandbox entity + bank account if they don't exist yet. */
  provision: (page: SyncPage = {}) => call<ProviderSnapshot>({ action: "provision", ...page }),
  sync: (page: SyncPage = {}) => call<ProviderSnapshot>({ action: "sync", ...page }),
  transfer: (args: TransferArgs) =>
    call<{ transferId: string; status: string; snapshot: ProviderSnapshot }>({ action: "transfer", ...args }),
  /** Uploads a KYC document and links it to the entity as verification evidence. */
  submitEvidence: (args: { dataUrl: string; documentType: ColumnDocumentType; purposes?: ColumnEvidencePurpose[] }) =>
    call<{ documentId: string | null; entityId: string; status: string }>({ action: "submit_evidence", ...args }),
  /** What the banking partner still needs from the signed-in user, if anything. */
  myCompliance: () =>
    call<{ entityId: string | null; verificationStatus: string | null; requirements: ComplianceItem[] }>({
      action: "my_compliance",
    }),
  /** Joint ownership: pending requests in both directions + owner rosters. */
  jointList: () => call<JointOverview>({ action: "joint_list" }),
  jointRequest: (bankAccountId: string, email: string) =>
    call<{ sent: boolean; message: string }>({ action: "joint_request", bankAccountId, email }),
  jointRespond: (requestId: string, accept: boolean) =>
    call<{ status: string; bankAccountId?: string }>({ action: "joint_respond", requestId, accept }),
  jointCancel: (requestId: string) => call<{ status: string }>({ action: "joint_cancel", requestId }),
  jointRemove: (bankAccountId: string, userId?: string) =>
    call<{ removed: boolean; providerRemoved: boolean; providerNote: string | null }>({
      action: "joint_remove", bankAccountId, userId,
    }),

  adminList: () => call<Record<string, unknown>>({ action: "admin_list" }),
  adminLocal: () => call<Record<string, unknown>>({ action: "admin_local" }),
  adminCompliance: (entityId: string) =>
    call<{ items: ComplianceItem[] } & Record<string, unknown>>({ action: "admin_compliance", entityId }),
  adminDelete: (resource: string, id: string) => call<unknown>({ action: "admin_delete", resource, id }),
  /** Every webhook endpoint Column currently has registered for this platform. */
  adminWebhookEndpoints: () =>
    call<{ endpoints: WebhookEndpoint[] }>({ action: "admin_webhook_endpoints" }),
  /** Asks Column to make a real delivery attempt so we can see the response. */
  adminWebhookVerify: (id: string, eventType = "ach.outgoing_transfer.initiated") =>
    call<WebhookVerifyResult>({ action: "admin_webhook_verify", id, eventType }),
  /** Column's own log of recent delivery attempts to an endpoint. */
  adminWebhookDeliveries: (id: string, limit = 25) =>
    call<{ deliveries: WebhookDelivery[] }>({ action: "admin_webhook_deliveries", id, limit }),
  /** Flags events Column recorded that never reached our webhook_events table. */
  adminReconcileEvents: (limit = 200) =>
    call<EventReconciliation>({ action: "admin_reconcile_events", limit }),

  /** Registers this deployment's webhook receiver with the provider (idempotent). */
  adminRegisterWebhook: () =>
    call<{ created: boolean; url: string; endpoint: Record<string, unknown> }>({ action: "admin_register_webhook" }),
  /** Sandbox unhappy path: forces an ACH return of the given kind. */
  adminSimulateAchReturn: (receiverName: string, amount?: number) =>
    call<{ transferId: string; status: string; expectedReturn: string }>({
      action: "admin_simulate_ach_return", receiverName, amount,
    }),
  /** Sandbox: pushes an incoming wire into the caller's checking account. */
  adminSimulateIncomingWire: (amount?: number) =>
    call<{ transferId: string | null; status: string; amount: number }>({
      action: "admin_simulate_incoming_wire", amount,
    }),

  adminWipe: (includeWebhooks = false) =>
    call<{ wiped: number; results: Array<{ resource: string; id: string; ok: boolean; error?: string }> }>({
      action: "admin_wipe",
      includeWebhooks,
    }),
};



/**
 * Replaces the local ledger's balances and transactions with the live provider
 * state. In live mode NOTHING is simulated: an account the provider does not
 * know about is shown at zero rather than at its last demo value.
 */
export function mergeProviderIntoLedger(ledger: DemoLedger, snap: ProviderSnapshot): DemoLedger {
  if (!snap.provisioned || !snap.accounts.length) return ledger;

  const byType = (t: string) => snap.accounts.find((a) => a.type === t);
  const idMap = new Map<string, string>(); // local account id -> provider account id

  const accounts: DemoAccount[] = ledger.accounts.map((a) => {
    const live = byType(a.type) ?? (a.type === "checking" ? snap.accounts[0] : undefined);
    if (!live) {
      return { ...a, availableBalance: 0, currentBalance: 0, pendingAmount: 0 };
    }
    idMap.set(live.id, a.id);
    return {
      ...a,
      name: live.name || a.name,
      accountNumber: live.accountNumber || a.accountNumber,
      routingNumber: live.routingNumber || a.routingNumber,
      availableBalance: live.available,
      currentBalance: live.current,
      pendingAmount: live.pending,
      status: live.status,
      isJoint: live.isJoint ?? (live.owners?.length ?? 0) > 1,
      myRole: live.myRole,
      owners: live.owners,
    };
  });

  const fallbackId = accounts.find((a) => a.type === "checking")?.id ?? accounts[0]?.id;

  const transactions: DemoTransaction[] = snap.transactions.map((t) => ({
    ...t,
    icon: t.type === "credit" ? "↓" : "↑",
    account: idMap.get(t.account) ?? fallbackId ?? t.account,
  }));

  return { ...ledger, accounts, transactions };
}

