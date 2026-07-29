import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2, AlertTriangle, Webhook, Undo2, ArrowDownToLine } from "lucide-react";
import { ledgerProvider, getDataSource, setDataSource, type DataSource } from "@/lib/ledgerProvider";
import { AdminHeader, AdminPage } from "./AdminShell";
import ConfirmDialog from "@/components/glass/ConfirmDialog";

type Listing = {
  entities?: Array<Record<string, unknown>>;
  bankAccounts?: Array<Record<string, unknown>>;
  counterparties?: Array<Record<string, unknown>>;
  webhookEndpoints?: Array<Record<string, unknown>>;
  errors?: Record<string, string | undefined>;
};

const RESOURCES: Array<{ key: keyof Listing; resource: string; label: string }> = [
  { key: "entities", resource: "entity", label: "Entities" },
  { key: "bankAccounts", resource: "bank-account", label: "Bank accounts" },
  { key: "counterparties", resource: "counterparty", label: "Counterparties" },
  { key: "webhookEndpoints", resource: "webhook-endpoint", label: "Webhook endpoints" },
];

const AdminProvider = () => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState<{ sandbox: boolean; configured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [source, setSource] = useState<DataSource>(getDataSource());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([ledgerProvider.status(), ledgerProvider.adminList()]);
      setStatus(s);
      setListing(l as Listing);
    } catch (e) {
      toast.error("Could not reach the provider", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (resource: string, id: string) => {
    try {
      await ledgerProvider.adminDelete(resource, id);
      toast.success("Deleted", { description: id });
      void load();
    } catch (e) {
      toast.error("Delete failed", { description: (e as Error).message });
    }
  };

  const wipe = async () => {
    setWipeOpen(false);
    const id = toast.loading("Wiping provider sandbox…");
    try {
      const res = await ledgerProvider.adminWipe(false);
      const failed = res.results.filter((r) => !r.ok).length;
      toast.success(`Wiped ${res.wiped - failed} object(s)`, {
        id,
        description: failed ? `${failed} could not be deleted` : "Sandbox is clean",
      });
      void load();
    } catch (e) {
      toast.error("Wipe failed", { id, description: (e as Error).message });
    }
  };

  return (
    <AdminPage>
      <AdminHeader
        title="Banking provider sandbox"
        subtitle="Test-environment entities, accounts and webhooks created by this app."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span
          className={`text-xs px-2.5 py-1 rounded-full ${
            status?.sandbox ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {status?.configured ? (status.sandbox ? "Sandbox key (test_)" : "NON-SANDBOX KEY") : "No API key set"}
        </span>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Data source
          <select
            value={source}
            onChange={(e) => {
              const next = e.target.value as DataSource;
              setSource(next);
              setDataSource(next);
              toast.success(`Switched to ${next === "live" ? "provider sandbox" : "local demo ledger"}`, {
                description: "Reload the app to re-hydrate balances.",
              });
            }}
            className="h-9 rounded-lg bg-card border border-border px-2 text-foreground"
          >
            <option value="demo">Local demo ledger</option>
            <option value="live">Provider sandbox</option>
          </select>
        </label>
        <button onClick={() => void load()} className="h-9 px-3 rounded-lg border border-border text-xs flex items-center gap-1.5">
          <RefreshCw size={14} /> Refresh
        </button>
        <button
          onClick={() => void registerWebhook()}
          disabled={busy}
          className="h-9 px-3 rounded-lg border border-border text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <Webhook size={14} /> Register webhook endpoint
        </button>
        <button
          onClick={() => setWipeOpen(true)}
          className="h-9 px-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-1.5"
        >
          <AlertTriangle size={14} /> Delete everything
        </button>
      </div>

      <section className="mb-8 p-4 rounded-xl border border-border bg-card">
        <h2 className="text-sm font-semibold text-foreground mb-1">Sandbox simulators</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Fires real provider events against your own accounts so the unhappy paths
          (return → webhook → notification) can be tested end to end.
        </p>
        <div className="flex flex-wrap gap-2">
          {ACH_RETURNS.map((code) => (
            <button
              key={code}
              disabled={busy}
              onClick={() => void simulateReturn(code)}
              className="h-9 px-3 rounded-lg border border-border text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 size={14} /> {code}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() => void simulateWire()}
            className="h-9 px-3 rounded-lg border border-border text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <ArrowDownToLine size={14} /> Simulate incoming wire ($500)
          </button>
        </div>
      </section>


      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading &&
        RESOURCES.map(({ key, resource, label }) => {
          const items = (listing?.[key] as Array<Record<string, unknown>>) ?? [];
          const err = listing?.errors?.[key as string];
          return (
            <section key={resource} className="mb-8">
              <h2 className="text-sm font-semibold text-foreground mb-2">
                {label} <span className="text-muted-foreground font-normal">({items.length})</span>
              </h2>
              {err && <p className="text-xs text-destructive mb-2">{err}</p>}
              {!items.length && !err && <p className="text-xs text-muted-foreground">None</p>}
              <div className="space-y-1.5">
                {items.map((item) => {
                  const id = String(item.id ?? "");
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-card border border-border"
                    >
                      <div className="min-w-0">
                        <code className="text-xs text-foreground">{id}</code>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {String(
                            item.description ??
                              item.verification_status ??
                              item.url ??
                              item.first_name ??
                              "",
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => void remove(resource, id)}
                        aria-label={`Delete ${label} ${id}`}
                        className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

      <ConfirmDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        title="Delete all provider sandbox objects?"
        description="This deletes every counterparty, bank account and entity in the provider sandbox and clears the local mirror tables. Webhook endpoints are kept."
        confirmLabel="Delete everything"
        destructive
        onConfirm={() => void wipe()}
      />
    </AdminPage>
  );
};

export default AdminProvider;
