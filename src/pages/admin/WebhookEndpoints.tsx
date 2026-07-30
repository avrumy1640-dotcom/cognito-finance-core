import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2, Send, ScrollText, ShieldQuestion } from "lucide-react";
import {
  ledgerProvider,
  friendlyProviderMessage,
  type EventReconciliation,
  type WebhookDelivery,
  type WebhookEndpoint,
} from "@/lib/ledgerProvider";

/**
 * Webhook operations console.
 *
 * Answers the question "is our banking partner actually delivering events to
 * us?" without leaving the app: list what they have registered, force a real
 * delivery attempt, read their own delivery log, and reconcile their event
 * ledger against the rows we actually recorded.
 */

/** Event types worth firing a real test delivery with. */
const VERIFY_EVENTS = [
  "ach.outgoing_transfer.initiated",
  "entity.verified",
  "book.transfer.completed",
] as const;

const statusTone = (ok: boolean | null) => {
  if (ok === true) return "text-success";
  if (ok === false) return "text-destructive";
  return "text-muted-foreground";
};

const WebhookEndpoints = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [eventType, setEventType] = useState<string>(VERIFY_EVENTS[0]);
  const [recon, setRecon] = useState<EventReconciliation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ledgerProvider.adminWebhookEndpoints();
      setEndpoints(res.endpoints ?? []);
    } catch (e) {
      toast.error("Could not list webhook endpoints", { description: friendlyProviderMessage(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const verify = async (id: string) => {
    setBusy(id);
    const t = toast.loading(`Asking the provider to deliver ${eventType}…`);
    try {
      const res = await ledgerProvider.adminWebhookVerify(id, eventType);
      const ok = res.success === true || (res.statusCode !== null && res.statusCode < 300);
      const detail = [
        res.statusCode !== null ? `HTTP ${res.statusCode}` : null,
        res.responseBody?.slice(0, 160),
        ok ? "Provider accepted the delivery" : null,
      ].filter(Boolean).join(" · ") || "Delivery attempted — see the log below";
      if (ok) toast.success("Delivery attempted successfully", { id: t, description: detail });
      else toast.error("Delivery attempt failed", { id: t, description: detail });
      void showLog(id);
    } catch (e) {
      toast.error("Verify failed", { id: t, description: friendlyProviderMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const showLog = async (id: string) => {
    setOpenLog((cur) => (cur === id ? null : id));
    try {
      const res = await ledgerProvider.adminWebhookDeliveries(id, 25);
      setDeliveries((d) => ({ ...d, [id]: res.deliveries ?? [] }));
    } catch (e) {
      toast.error("Could not load delivery log", { description: friendlyProviderMessage(e) });
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await ledgerProvider.adminDelete("webhook-endpoint", id);
      toast.success("Endpoint deleted", { description: id });
      void load();
    } catch (e) {
      toast.error("Delete failed", { description: friendlyProviderMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const reconcile = async () => {
    const t = toast.loading("Reconciling the provider's event ledger…");
    try {
      const res = await ledgerProvider.adminReconcileEvents(200);
      setRecon(res);
      toast.success(
        res.missingCount ? `${res.missingCount} event(s) never reached us` : "No gaps — every event was recorded",
        { id: t, description: `${res.recorded}/${res.checked} recorded locally` },
      );
    } catch (e) {
      toast.error("Reconciliation failed", { id: t, description: friendlyProviderMessage(e) });
    }
  };

  return (
    <section className="mb-8 p-4 rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h2 className="text-sm font-semibold text-foreground">Webhook endpoints</h2>
        <button onClick={() => void load()} className="h-8 px-2.5 rounded-lg border border-border text-xs flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={() => void reconcile()} className="h-8 px-2.5 rounded-lg border border-border text-xs flex items-center gap-1.5">
          <ShieldQuestion size={13} /> Reconcile events
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Everything the provider currently has registered. "Verify" makes them attempt a
        real delivery so we can see the exact response, and the log shows their own
        record of recent attempts.
      </p>

      <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        Test event
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground"
        >
          {VERIFY_EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </label>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && !endpoints.length && <p className="text-xs text-muted-foreground">No endpoints registered.</p>}

      <div className="space-y-2">
        {endpoints.map((ep) => (
          <div key={ep.id} className="rounded-lg border border-border bg-background/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-foreground break-all">{ep.url}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  <code>{ep.id}</code>
                  {ep.isDisabled && <span className="ml-2 text-destructive">disabled</span>}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ep.enabledEvents.length ? ep.enabledEvents.join(", ") : "all events"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => void verify(ep.id)}
                  disabled={busy === ep.id}
                  className="h-8 px-2 rounded-lg border border-border text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Send size={13} /> Verify
                </button>
                <button
                  onClick={() => void showLog(ep.id)}
                  className="h-8 px-2 rounded-lg border border-border text-xs flex items-center gap-1"
                >
                  <ScrollText size={13} /> Log
                </button>
                <button
                  onClick={() => void remove(ep.id)}
                  disabled={busy === ep.id}
                  aria-label={`Delete webhook endpoint ${ep.id}`}
                  className="h-8 w-8 grid place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {openLog === ep.id && (
              <div className="mt-3 border-t border-border pt-2 space-y-1">
                {!(deliveries[ep.id] ?? []).length && (
                  <p className="text-[11px] text-muted-foreground">
                    No delivery attempts recorded — the provider has never tried to reach this URL.
                  </p>
                )}
                {(deliveries[ep.id] ?? []).map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-3 text-[11px]">
                    <span className="text-muted-foreground truncate">
                      {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"} · {d.eventType ?? "event"}
                    </span>
                    <span className={`shrink-0 ${statusTone(d.success)}`}>
                      {d.status ?? (d.statusCode ? `HTTP ${d.statusCode}` : "—")}
                      {d.attempts ? ` · ${d.attempts} attempt(s)` : ""}
                      {d.error ? ` · ${d.error.slice(0, 60)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {recon && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-semibold text-foreground mb-1">
            Event reconciliation — {recon.recorded}/{recon.checked} recorded locally
          </p>
          {!recon.missingCount && <p className="text-[11px] text-success">No gaps. Every provider event reached us.</p>}
          {recon.missing.map((m) => (
            <p key={m.id} className="text-[11px] text-destructive">
              Never received: <code>{m.id}</code> · {m.type ?? "unknown"} ·{" "}
              {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
            </p>
          ))}
        </div>
      )}
    </section>
  );
};

export default WebhookEndpoints;
