import { useState } from "react";
import { formatTxDate } from "@/lib/dates";
import { useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { transferStatusInfo } from "@/lib/transferStatus";
import { useBank } from "@/store/bankStore";
import { disputeReasonLabel, type DisputeReason } from "@/lib/demoBank";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Tag,
  AlertTriangle,
  MessageSquare,
  Download,
  ChevronRight,
  ShieldAlert,
  X,
} from "lucide-react";

const REASONS: DisputeReason[] = ["unauthorized", "wrong_amount", "duplicate", "not_received", "other"];
const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Income", "Transfer", "Other"];

const TransactionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { transactions, disputes, openDispute } = useBank();
  const tx = transactions.find((t) => t.id === id);
  const existingDispute = disputes.find((d) => d.transactionId === id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reason, setReason] = useState<DisputeReason>("unauthorized");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [category, setCategory] = useState(tx?.category ?? "Other");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savedNote, setSavedNote] = useState("");


  const submitDispute = async () => {
    if (!tx) return;
    setSubmitting(true);
    const created = await openDispute({
      transactionId: tx.id,
      merchant: tx.merchant,
      amount: tx.amount,
      reason,
      note,
    });
    setSubmitting(false);
    if (created) {
      setSheetOpen(false);
      setNote("");
      navigate("/disputes");
    }
  };

  if (!tx) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Transaction not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-sm font-semibold text-foreground">Transaction Details</h1>
          <button
            onClick={() => navigate("/disputes")}
            className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="View your disputes"
          >
            <ShieldAlert size={20} className="text-foreground" aria-hidden="true" />
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
            <span className="text-sm text-muted-foreground">
              {transferStatusInfo(tx.providerStatus, tx.status).label}
            </span>
          </div>
        </motion.div>

        {/* Details */}
        <GlassCard className="space-y-3">
          {[
            { label: "Date & Time", value: formatTxDate(tx.date) },
            { label: "Category", value: tx.category },
            { label: "Payment Method", value: tx.paymentMethod },
            { label: "Account", value: tx.account },
            { label: "Status", value: transferStatusInfo(tx.providerStatus, tx.status).label },
            { label: "What this means", value: transferStatusInfo(tx.providerStatus, tx.status).hint },
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

        {/* Categorize — inline, in place */}
        <GlassCard className="space-y-3">
          <button
            onClick={() => setCatOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 min-h-[44px] text-left"
          >
            <span className="flex items-center gap-3 min-w-0">
              <Tag size={18} className="text-primary shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground leading-snug">Category</span>
                <span className="block text-xs text-muted-foreground leading-snug">{category}</span>
              </span>
            </span>
            <ChevronRight
              size={16}
              className={`text-muted-foreground shrink-0 transition-transform ${catOpen ? "rotate-90" : ""}`}
            />
          </button>
          {catOpen && (
            <div className="flex flex-wrap gap-2 pt-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCategory(c);
                    setCatOpen(false);
                    toast.success(`Categorized as ${c}`);
                  }}
                  className={`min-h-[40px] px-4 rounded-full text-xs font-semibold leading-snug break-words transition-colors ${
                    category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Note — inline editor, never a prompt */}
        <GlassCard className="space-y-3">
          <button
            onClick={() => setNoteOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 min-h-[44px] text-left"
          >
            <span className="flex items-center gap-3 min-w-0">
              <MessageSquare size={18} className="text-primary shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground leading-snug">Note</span>
                <span className="block text-xs text-muted-foreground leading-snug break-words">
                  {savedNote || "Add a note for your records"}
                </span>
              </span>
            </span>
            <ChevronRight
              size={16}
              className={`text-muted-foreground shrink-0 transition-transform ${noteOpen ? "rotate-90" : ""}`}
            />
          </button>
          {noteOpen && (
            <div className="space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="e.g. Reimbursable client lunch"
                className="w-full p-3 rounded-xl bg-secondary text-sm text-foreground outline-none resize-none leading-snug"
              />
              <button
                onClick={() => {
                  setSavedNote(noteDraft.trim());
                  setNoteOpen(false);
                  toast.success(noteDraft.trim() ? "Note saved" : "Note cleared");
                }}
                className="w-full min-h-[52px] px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold leading-snug"
              >
                Save note
              </button>
            </div>
          )}
        </GlassCard>

        <div className="space-y-2">
          {[
            {
              icon: AlertTriangle,
              label: existingDispute ? `Dispute ${existingDispute.caseNumber}` : "Report a problem",
              destructive: !existingDispute,
              action: () => (existingDispute ? navigate("/disputes") : setSheetOpen(true)),
            },
            { icon: Download, label: "Download Receipt", action: () => {
              const body = `Glass Bank Receipt\nTransaction ID: ${tx.id}\nGenerated ${new Date().toLocaleString()}\n`;
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
            <GlassCard
              key={action.label}
              onClick={action.action}
              className="flex items-center justify-between gap-3 py-3 min-h-[56px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <action.icon size={18} className={action.destructive ? "text-destructive shrink-0" : "text-primary shrink-0"} />
                <span className={`text-sm font-medium leading-snug break-words ${action.destructive ? "text-destructive" : "text-foreground"}`}>
                  {action.label}
                </span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </GlassCard>
          ))}
        </div>


        {existingDispute && (
          <GlassCard
            onClick={() => navigate("/disputes")}
            className="flex items-center gap-3 py-3 mb-6"
          >
            <ShieldAlert size={18} className="text-warning" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {existingDispute.status === "resolved" ? "Dispute resolved" : "Dispute under review"}
              </p>
              <p className="text-xs text-muted-foreground">
                Case {existingDispute.caseNumber} · {disputeReasonLabel(existingDispute.reason)}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </GlassCard>
        )}
      </div>

      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/40 flex items-end"
            onClick={() => !submitting && setSheetOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-background rounded-t-3xl p-5 pb-8 space-y-4 max-h-[88vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">Report a problem</h3>
                  <p className="text-xs text-muted-foreground">
                    {tx.merchant} · ${Math.abs(tx.amount).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
                >
                  <X size={16} className="text-foreground" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="kicker text-muted-foreground">What went wrong?</p>
                {REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm transition-colors ${
                      reason === r ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {disputeReasonLabel(r)}
                    {reason === r && <span className="text-xs">Selected</span>}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="dispute-note" className="kicker text-muted-foreground">
                  Add a note (optional)
                </label>
                <textarea
                  id="dispute-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Tell us what happened…"
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none resize-none"
                />
              </div>

              <button
                onClick={() => void submitDispute()}
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit dispute"}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                You'll get a case number right away. Most reviews finish within 10 business days.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionDetail;
