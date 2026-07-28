import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Plus, Share2, Check, X, Loader2 } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";
import EmptyState from "@/components/glass/EmptyState";
import { HandCoins } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Request = {
  id: string;
  requester_id: string;
  payer_id: string | null;
  payer_email: string | null;
  payer_name: string | null;
  amount_cents: number;
  currency: string;
  note: string | null;
  status: "pending" | "paid" | "declined" | "cancelled" | "expired";
  created_at: string;
};

const schema = z.object({
  payer_email: z.string().trim().email("Enter a valid email"),
  payer_name: z.string().trim().max(80).optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be positive").max(1_000_000),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

const money = (c: number, cur: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(c / 100);

const PaymentRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Request[] | null>(null);
  const [tab, setTab] = useState<"outgoing" | "incoming">("outgoing");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ payer_email: "", payer_name: "", amount: "", note: "" });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Request[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const list = useMemo(() => {
    if (!rows || !user) return [];
    return rows.filter((r) => (tab === "outgoing" ? r.requester_id === user.id : r.payer_id === user.id));
  }, [rows, tab, user]);

  const create = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setSaving(true);
    const cents = Math.round(parsed.data.amount * 100);
    const { data, error } = await supabase
      .from("payment_requests")
      .insert({
        requester_id: user.id,
        payer_email: parsed.data.payer_email,
        payer_name: form.payer_name || null,
        amount_cents: cents,
        currency: "USD",
        note: form.note || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment request created");
    setShowForm(false);
    setForm({ payer_email: "", payer_name: "", amount: "", note: "" });
    load();
    // offer share link
    const link = `${window.location.origin}/payment-requests?id=${data!.id}`;
    if (navigator.share) navigator.share({ title: "Payment request", text: `Requested ${money(cents, "USD")}`, url: link }).catch(() => {});
    else navigator.clipboard.writeText(link).then(() => toast.info("Link copied to clipboard"));
  };

  const setStatus = async (r: Request, status: Request["status"]) => {
    const { error } = await supabase.from("payment_requests").update({ status }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Request ${status}`);
    load();
  };

  const share = async (r: Request) => {
    const link = `${window.location.origin}/payment-requests?id=${r.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Payment request", text: `Requesting ${money(r.amount_cents, r.currency)}`, url: link }); return; } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(link);
    toast.info("Link copied");
  };

  return (
    <AppLayout>
      <div className="px-5 pt-6 pb-8 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold text-foreground">Payment requests</h1>
            <p className="text-sm text-muted-foreground">Ask anyone to pay you — email or link</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            aria-label="New request"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["outgoing", "incoming"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 rounded-lg text-xs font-medium capitalize ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="space-y-3">
              <Field label="Payer email">
                <input value={form.payer_email} onChange={(e) => setForm({ ...form, payer_email: e.target.value })} className={input} placeholder="friend@example.com" />
              </Field>
              <Field label="Payer name (optional)">
                <input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} className={input} />
              </Field>
              <Field label="Amount (USD)">
                <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input} placeholder="0.00" />
              </Field>
              <Field label="Note">
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={input} placeholder="What is this for?" />
              </Field>
              <button onClick={create} disabled={saving} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />} Create & share
              </button>
            </GlassCard>
          </motion.div>
        )}

        {rows === null ? (
          <GlassCard className="text-center py-6 text-sm text-muted-foreground">Loading…</GlassCard>
        ) : list.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title={tab === "outgoing" ? "No requests sent yet" : "Nothing owed to you"}
            description={
              tab === "outgoing"
                ? "Ask someone to pay you back — they get a link and the money lands in your checking account."
                : "When someone requests money from you, it shows up here so you can pay or decline."
            }
            actions={
              tab === "outgoing"
                ? [{ label: "Request money", onClick: () => setShowForm(true) }]
                : [{ label: "Request money instead", onClick: () => setTab("outgoing"), variant: "ghost" }]
            }
          />
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <GlassCard key={r.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{money(r.amount_cents, r.currency)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tab === "outgoing" ? `To ${r.payer_email ?? r.payer_name ?? "—"}` : "From requester"}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    r.status === "paid" ? "bg-emerald-500/10 text-emerald-600" :
                    r.status === "pending" ? "bg-primary/10 text-primary" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {r.status}
                  </span>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    {tab === "outgoing" ? (
                      <>
                        <button onClick={() => share(r)} className="flex-1 py-2 rounded-lg bg-secondary text-xs font-medium flex items-center justify-center gap-1">
                          <Share2 size={12} /> Share
                        </button>
                        <button onClick={() => setStatus(r, "cancelled")} className="py-2 px-3 rounded-lg bg-secondary text-xs text-muted-foreground">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setStatus(r, "paid"); navigate(`/move-money/send?amount=${r.amount_cents / 100}`); }}
                          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1"
                        >
                          <Check size={12} /> Pay
                        </button>
                        <button onClick={() => setStatus(r, "declined")} className="py-2 px-3 rounded-lg bg-secondary text-xs text-muted-foreground flex items-center gap-1">
                          <X size={12} /> Decline
                        </button>
                      </>
                    )}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const input = "w-full p-2.5 rounded-lg bg-secondary text-sm outline-none";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
    {children}
  </div>
);

export default PaymentRequests;
