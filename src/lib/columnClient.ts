// Column (BaaS) sandbox client — the ONLY client-side entry point to the
// Column integration. Everything hits the `column-api` edge function; the API
// key never leaves the server.
//
// Rip-out note: delete this file, `supabase/functions/column-api`,
// `supabase/functions/column-webhook` and the `column_*` tables to fully
// remove the integration.
import { supabase } from "@/integrations/supabase/client";
import type { DemoAccount, DemoLedger, DemoTransaction } from "@/lib/demoBank";

const FLAG_KEY = "glassbank.dataSource";
export type DataSource = "demo" | "column";

/** Which ledger the app reads from. Defaults to the local demo ledger. */
export function getDataSource(): DataSource {
  if (typeof localStorage === "undefined") return "demo";
  return localStorage.getItem(FLAG_KEY) === "column" ? "column" : "demo";
}

export function setDataSource(source: DataSource) {
  localStorage.setItem(FLAG_KEY, source);
}

export const isColumnMode = () => getDataSource() === "column";

export interface ColumnAccount {
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

export interface ColumnSnapshot {
  provisioned: boolean;
  entity: { entityId: string; verificationStatus: string } | null;
  accounts: ColumnAccount[];
  transactions: Array<Omit<DemoTransaction, "icon">>;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("column-api", { body });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const columnClient = {
  status: () => call<{ sandbox: boolean; configured: boolean; entity: unknown }>({ action: "status" }),
  /** Creates the sandbox entity + bank account if they don't exist yet. */
  provision: () => call<ColumnSnapshot>({ action: "provision" }),
  sync: () => call<ColumnSnapshot>({ action: "sync" }),
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
 * Overlays live Column balances and transactions onto the existing ledger
 * shape so the UI stays completely unchanged — this is a data-layer swap only.
 */
export function mergeColumnIntoLedger(ledger: DemoLedger, snap: ColumnSnapshot): DemoLedger {
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
