import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeftRight, Building2, Globe, CalendarClock, Users2, Loader2, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import { ledgerProvider, friendlyProviderMessage, type ProviderSnapshot } from "@/lib/ledgerProvider";
import { money } from "./BusinessHome";

const methods = [
  { label: "Pay a vendor (ACH)", desc: "1–3 business days · Free", icon: Building2, to: "/move-money/external" },
  { label: "Wire payment", desc: "Same business day · $25 fee", icon: Globe, to: "/move-money/wire" },
  { label: "Between business accounts", desc: "Instant · Free", icon: ArrowLeftRight, to: "/move-money/transfer" },
  { label: "Scheduled payments", desc: "Rent, payroll, recurring bills", icon: CalendarClock, to: "/scheduled" },
  { label: "Vendors & recipients", desc: "Saved bank details", icon: Users2, to: "/beneficiaries" },
];

/**
 * Business payments hub. Deliberately outgoing-first: a company pays vendors,
 * payroll and bills far more often than it moves money between its own pots.
 * Every tile routes into the existing, working transfer flow.
 */
const Payments = () => {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<ProviderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSnap(await ledgerProvider.sync({ limit: 12 })); }
    catch (e) { setError(friendlyProviderMessage(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const payments = (snap?.transactions ?? []).filter((t) => t.amount < 0).slice(0, 8);

  return (
    <AppLayout>
      <Seo title="Business payments | Glass Bank" description="Pay vendors, send wires and schedule recurring business payments." path="/payments" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Pay vendors, run wires and schedule recurring bills.</p>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <button key={m.to} onClick={() => navigate(m.to)} className="text-left">
              <GlassCard className="flex items-center gap-3 h-full">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <m.icon size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{m.desc}</p>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>

        <h2 className="text-section-title px-1">Recent payments</h2>
        {error && <GlassCard><p className="text-sm text-destructive">{error}</p></GlassCard>}
        {!snap && !error && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
        {snap && payments.length === 0 && (
          <GlassCard><p className="text-sm text-muted-foreground">No payments yet.</p></GlassCard>
        )}
        <div className="space-y-2">
          {payments.map((t) => (
            <GlassCard key={t.id} className="p-0 overflow-hidden">
              <button
                onClick={() => navigate(`/transaction/${t.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-secondary/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  {t.amount < 0 ? <ArrowUpRight size={17} className="text-muted-foreground" /> : <ArrowDownLeft size={17} className="text-success" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.date).toLocaleDateString()} · {t.status}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground tabular-nums">{money(t.amount)}</p>
              </button>
            </GlassCard>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Payments;
