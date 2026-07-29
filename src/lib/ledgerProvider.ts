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
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ledger-sync", { body });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const ledgerProvider = {
  status: () => call<{ sandbox: boolean; configured: boolean; entity: unknown }>({ action: "status" }),
  /** Creates the sandbox entity + bank account if they don't exist yet. */
  provision: () => call<ProviderSnapshot>({ action: "provision" }),
  sync: () => call<ProviderSnapshot>({ action: "sync" }),
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
 * Overlays live provider balances and transactions onto the existing ledger
 * shape so the UI stays completely unchanged — this is a data-layer swap only.
 */
export function mergeProviderIntoLedger(ledger: DemoLedger, snap: ProviderSnapshot): DemoLedger {
  if (!snap.provisioned || !snap.accounts.length) return ledger;
  const primary = snap.accounts[0];
  const checking = ledger.accounts.find((a) => a.type === "checking");

  const accounts: DemoAccount[] = ledger.accounts.map((a) =>
    a.id === checking?.id
      ? {
          ...a,
          name: primary.name || a.name,
          accountNumber: primary.accountNumber || a.accountNumber,
          routingNumber: primary.routingNumber || a.routingNumber,
          availableBalance: primary.available,
          currentBalance: primary.current,
          pendingAmount: primary.pending,
          status: primary.status,
        }
      : a,
  );

  const transactions: DemoTransaction[] = snap.transactions.map((t) => ({
    ...t,
    icon: t.type === "credit" ? "ArrowDownLeft" : "ArrowUpRight",
    account: checking?.id ?? t.account,
  }));

  return { ...ledger, accounts, transactions };
}
