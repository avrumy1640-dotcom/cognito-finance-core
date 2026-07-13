import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Tag,
  AlertTriangle,
  MessageSquare,
  Download,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";

const TransactionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { transactions } = useBank();
  const tx = transactions.find((t) => t.id === id);

  if (!tx) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Transaction not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-sm font-semibold text-foreground">Transaction Details</h1>
          <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <MoreHorizontal size={20} className="text-foreground" />
          </button>
        </div>

        {/* Main Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center mb-3">
            <span className="text-3xl">{tx.icon}</span>
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">{tx.merchant}</h2>
          <p className={`text-3xl font-display font-bold mt-2 ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
            {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${tx.status === "pending" ? "bg-warning" : "bg-success"}`} />
            <span className="text-sm text-muted-foreground capitalize">{tx.status}</span>
          </div>
        </motion.div>

        {/* Details */}
        <GlassCard className="space-y-3">
          {[
            { label: "Date & Time", value: tx.date },
            { label: "Category", value: tx.category },
            { label: "Payment Method", value: tx.paymentMethod },
            { label: "Account", value: tx.account },
            { label: "Status", value: tx.status.charAt(0).toUpperCase() + tx.status.slice(1) },
            { label: "Transaction ID", value: tx.id.toUpperCase() },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium text-foreground">{row.value}</span>
            </div>
          ))}
        </GlassCard>

        {/* Location placeholder */}
        <GlassCard className="flex items-center gap-3 py-3">
          <MapPin size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Location</p>
            <p className="text-xs text-muted-foreground">San Francisco, CA</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </GlassCard>

        <div className="space-y-2">
          {[
            { icon: Tag, label: "Categorize Transaction", action: () => {
              const cats = ["Food", "Transport", "Shopping", "Bills", "Income", "Transfer", "Other"];
              const pick = prompt(`Pick a category:\n${cats.map((c, i) => `${i + 1}. ${c}`).join("\n")}`);
              const idx = pick ? parseInt(pick, 10) - 1 : -1;
              if (idx >= 0 && cats[idx]) toast.success(`Categorized as ${cats[idx]}`);
            } },
            { icon: MessageSquare, label: "Add Note", action: () => { const n = prompt("Add a note"); if (n) toast.success("Note saved"); } },
            { icon: AlertTriangle, label: "Dispute Charge", destructive: true, action: () => { if (confirm("Open a dispute for this charge?")) toast.success("Dispute opened", { description: "We'll review within 10 business days" }); } },
            { icon: Download, label: "Download Receipt", action: () => {
              const body = `Glass Bank Receipt\nTransaction ID: demo\nGenerated ${new Date().toLocaleString()}\n`;
              const blob = new Blob([body], { type: "application/pdf" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `receipt.pdf`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              toast.success("Receipt downloaded");
            } },
          ].map((action) => (
            <GlassCard key={action.label} onClick={action.action} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <action.icon size={18} className={action.destructive ? "text-destructive" : "text-primary"} />
                <span className={`text-sm font-medium ${action.destructive ? "text-destructive" : "text-foreground"}`}>
                  {action.label}
                </span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TransactionDetail;
