// Internal ledger-provider client.
//
// The ONLY client-side entry point to the sandbox banking provider. All calls
// go through the `ledger-sync` edge function; provider name, base URL and API
// key never reach the browser. Response shapes here are deliberately generic
// (accounts / transactions / entity) so devtools reveal nothing about the
// upstream vendor.
import { supabase } from "@/integrations/supabase/client";
import type { DemoAccount, DemoLedger, DemoTransaction } from "@/lib/demoBank";

const FLAG_KEY = "glassbank.dataSource";
export type DataSource = "demo" | "live";

/** Which ledger the app reads from. Defaults to the local demo ledger. */
export function getDataSource(): DataSource {
  if (typeof localStorage === "undefined") return "demo";
  return localStorage.getItem(FLAG_KEY) === "live" ? "live" : "demo";
}

export function setDataSource(source: DataSource) {
  localStorage.setItem(FLAG_KEY, source);
}

export const isLiveMode = () => getDataSource() === "live";

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

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ledger-sync", { body });
  if (error) {
    // Surface the real server-side reason instead of a generic "non-2xx".
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const detail = JSON.parse(await ctx.text()) as { error?: string };
        if (detail?.error) throw new Error(detail.error);
      } catch (e) {
        if (e instanceof Error && e.message && !/JSON/.test(e.message)) throw e;
      }
    }
    throw new Error(error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
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
}

export const ledgerProvider = {
  status: () => call<{ sandbox: boolean; configured: boolean; entity: unknown }>({ action: "status" }),
  diagnose: () =>
    call<{ configured: boolean; sandbox: boolean; webhookSecret: boolean; reachable: boolean; entityCount?: number; error?: string }>({
      action: "diagnose",
    }),
  /** Creates the sandbox entity + bank account if they don't exist yet. */
  provision: (page: SyncPage = {}) => call<ProviderSnapshot>({ action: "provision", ...page }),
  sync: (page: SyncPage = {}) => call<ProviderSnapshot>({ action: "sync", ...page }),
  transfer: (args: TransferArgs) =>
    call<{ transferId: string; status: string; snapshot: ProviderSnapshot }>({ action: "transfer", ...args }),
  adminList: () => call<Record<string, unknown>>({ action: "admin_list" }),
  adminLocal: () => call<Record<string, unknown>>({ action: "admin_local" }),
  adminDelete: (resource: string, id: string) => call<unknown>({ action: "admin_delete", resource, id }),
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

