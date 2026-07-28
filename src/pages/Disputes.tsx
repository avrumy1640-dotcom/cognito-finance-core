import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { disputeReasonLabel } from "@/lib/demoBank";
import { ArrowLeft, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const Disputes = () => {
  const navigate = useNavigate();
  const { disputes } = useBank();

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center press">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Support</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Disputes</h1>
          </div>
        </div>

        {disputes.length === 0 ? (
          <GlassCard className="text-center py-10">
            <ShieldAlert size={36} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No disputes filed</p>
            <p className="text-xs text-muted-foreground mt-1 px-6">
              Spot a charge you don't recognise? Open the transaction and tap "Report a problem".
            </p>
            <button onClick={() => navigate("/activity")} className="mt-4 text-xs font-semibold text-primary">
              Review recent activity →
            </button>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {disputes.map((d, i) => {
              const resolved = d.status === "resolved";
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <GlassCard onClick={() => navigate(`/transaction/${d.transactionId}`)} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{d.merchant}</p>
                        <p className="text-xs text-muted-foreground">{disputeReasonLabel(d.reason)}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{money(d.amount)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {resolved ? (
                        <CheckCircle2 size={14} className="text-success" />
                      ) : (
                        <Clock size={14} className="text-warning" />
                      )}
                      <span className={`text-xs font-medium ${resolved ? "text-success" : "text-warning"}`}>
                        {resolved ? "Resolved" : "Under review"}
                      </span>
                      <span className="text-xs text-muted-foreground">· Case {d.caseNumber}</span>
                    </div>

                    {d.note && <p className="text-xs text-muted-foreground">"{d.note}"</p>}
                    {d.resolution && <p className="text-xs text-foreground">{d.resolution}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      Filed {new Date(d.createdAt).toLocaleDateString()} · Decision within 10 business days
                    </p>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Disputes;
