import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Loader2, Landmark, Send, FileText, Receipt, Users, ArrowRight, Eye,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { ledgerProvider, friendlyProviderMessage, type ProviderSnapshot } from "@/lib/ledgerProvider";
import { useBusiness } from "@/hooks/useBusiness";

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const quickLinks = [
  { to: "/payments", label: "Payments", desc: "Pay vendors and move funds", icon: Send },
  { to: "/invoices", label: "Invoices", desc: "Bill clients and track payment", icon: FileText },
  { to: "/reimbursements", label: "Reimbursements", desc: "Approve team expenses", icon: Receipt },
  { to: "/team", label: "Team", desc: "Admins and view-only access", icon: Users },
];

/**
 * Business overview.
 *
 * Unlike the personal home screen (one checking + one savings), a business
 * sees every named account it has opened — each one a real, separately
 * numbered account at the banking partner, not a UI label.
 */
const BusinessHome = () => {
  const navigate = useNavigate();
  const { businessName } = useBusiness();
  const [snap, setSnap] = useState<ProviderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSnap(await ledgerProvider.sync({ limit: 5 }));
      setError(null);
    } catch (e) {
      setError(friendlyProviderMessage(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (name.trim().length < 2) return toast.error("Give the account a name");
    setBusy(true);
    try {
      const res = await ledgerProvider.subAccountCreate(name.trim());
      setSnap(res.snapshot);
      setName("");
      setCreating(false);
      toast.success(`${res.name} is open`);
    } catch (e) {
      toast.error(friendlyProviderMessage(e));
    } finally { setBusy(false); }
  };

  const accounts = snap?.accounts ?? [];
  const total = accounts.reduce((s, a) => s + (a.available ?? 0), 0);

  return (
    <AppLayout>
      <Seo title="Business overview | Glass Bank" description="All of your business accounts, balances and money movement in one place." path="/business" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="kicker text-primary">{businessName}</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Business overview</h1>
        </motion.div>

        <GlassCard elevated className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total available</p>
          <p className="text-4xl font-display font-bold text-foreground mt-1 tabular-nums">
            {snap ? money(total) : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </p>
        </GlassCard>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((q) => (
            <button key={q.to} onClick={() => navigate(q.to)} className="text-left">
              <GlassCard className="h-full flex flex-col gap-3 py-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <q.icon size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{q.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{q.desc}</p>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-1">
          <h2 className="text-section-title">Accounts</h2>
          <button
            onClick={() => setCreating((v) => !v)}
            className="text-xs font-semibold text-primary flex items-center gap-1"
          >
            <Plus size={14} /> New account
          </button>
        </div>

        {creating && (
          <GlassCard className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Open a named account</p>
            <p className="text-xs text-muted-foreground">
              Real, separately numbered accounts — use them for Payroll, Taxes or Operating funds.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Payroll"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={create}
              disabled={busy}
              className="w-full min-h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Open account
            </button>
          </GlassCard>
        )}

        {error && <GlassCard><p className="text-sm text-destructive">{error}</p></GlassCard>}

        {!snap && !error && (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
        )}

        <div className="space-y-2">
          {accounts.map((a) => (
            <GlassCard key={a.id} className="p-0 overflow-hidden">
              <button
                onClick={() => navigate(`/account/${a.id}`)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-secondary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Landmark size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.accountNumber} · {a.status}
                    {a.myRole === "viewer" && " · view only"}
                    {a.myRole === "admin" && " · admin"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular-nums">{money(a.available)}</p>
                  {a.pending > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">{money(a.pending)} pending</p>
                  )}
                </div>
                <ArrowRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            </GlassCard>
          ))}
        </div>

        {snap && accounts.some((a) => a.myRole === "viewer") && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
            <Eye size={13} /> View-only accounts can't be used to send money.
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default BusinessHome;
