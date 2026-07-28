import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { disputeReasonLabel, DISPUTE_STATUS_LABEL, type DisputeReason, type DisputeStatus } from "@/lib/demoBank";
import { formatTxDate } from "@/lib/dates";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Paperclip,
  X,
  FileCheck2,
  ChevronRight,
} from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const REASONS: DisputeReason[] = ["unauthorized", "wrong_amount", "duplicate", "not_received", "other"];
const STEPS: DisputeStatus[] = ["submitted", "under_review", "resolved"];
const MAX_FILE = 6 * 1024 * 1024;

type Evidence = { name: string; size: number; type: string };

const StatusTracker = ({ status }: { status: DisputeStatus }) => {
  const idx = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Case status: ${DISPUTE_STATUS_LABEL[status]}`}>
      {STEPS.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="flex-1 min-w-0">
            <div
              className={`h-1.5 rounded-full ${done ? (status === "resolved" ? "bg-success" : "bg-primary") : "bg-secondary"}`}
            />
            <span className={`mt-1 block text-[10px] font-medium truncate ${done ? "text-foreground" : "text-muted-foreground"}`}>
              {DISPUTE_STATUS_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const Disputes = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { disputes, transactions, openDispute } = useBank();

  const [composing, setComposing] = useState(Boolean(params.get("new")));
  const [query, setQuery] = useState("");
  const [txId, setTxId] = useState<string | null>(params.get("tx"));
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ tx?: string; reason?: string; note?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const disputedIds = useMemo(() => new Set(disputes.map((d) => d.transactionId)), [disputes]);
  const eligible = useMemo(
    () =>
      transactions
        .filter((t) => t.amount < 0 && !disputedIds.has(t.id))
        .filter((t) => t.merchant.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 40),
    [transactions, disputedIds, query],
  );
  const selectedTx = transactions.find((t) => t.id === txId) ?? null;

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Evidence[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE) {
        toast.error(`${f.name} is larger than 6 MB`);
        continue;
      }
      next.push({ name: f.name, size: f.size, type: f.type });
    }
    setEvidence((prev) => [...prev, ...next].slice(0, 5));
  };

  const reset = () => {
    setComposing(false);
    setTxId(null);
    setReason(null);
    setNote("");
    setEvidence([]);
    setErrors({});
  };

  const submit = async () => {
    const next: typeof errors = {};
    if (!selectedTx) next.tx = "Choose the transaction you want to dispute";
    if (!reason) next.reason = "Pick a reason so we can route your case";
    if (reason === "other" && note.trim().length < 10) next.note = "Add a short description (at least 10 characters)";
    setErrors(next);
    if (Object.keys(next).length || !selectedTx || !reason) return;
    setSubmitting(true);
    const created = await openDispute({
      transactionId: selectedTx.id,
      merchant: selectedTx.merchant,
      amount: selectedTx.amount,
      reason,
      note,
      evidence,
    });
    setSubmitting(false);
    if (created) reset();
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-12">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (composing ? reset() : navigate(-1))}
            className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center press"
            aria-label={composing ? "Cancel dispute" : "Go back"}
          >
            <ArrowLeft size={20} className="text-foreground" aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="kicker text-primary">Support</p>
            <h1 className="text-lg lg:text-2xl font-display font-bold text-foreground leading-tight">
              {composing ? "File a dispute" : "Disputes"}
            </h1>
          </div>
          {!composing && (
            <button
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-foreground text-background text-sm font-semibold press"
            >
              <Plus size={16} aria-hidden="true" /> New
            </button>
          )}
        </div>

        {composing ? (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {/* Step 1 — pick a transaction */}
            <GlassCard className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">1. Choose the transaction</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Only card and outgoing payments can be disputed.</p>
              </div>

              {selectedTx ? (
                <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
                  <span className="text-xl" aria-hidden="true">{selectedTx.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedTx.merchant}</p>
                    <p className="text-xs text-muted-foreground">{formatTxDate(selectedTx.date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {money(Math.abs(selectedTx.amount))}
                  </span>
                  <button
                    onClick={() => setTxId(null)}
                    className="h-11 w-11 -mr-2 flex items-center justify-center rounded-full"
                    aria-label="Choose a different transaction"
                  >
                    <X size={16} className="text-muted-foreground" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search merchant"
                      aria-label="Search transactions"
                      className="w-full min-h-11 rounded-xl bg-secondary/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                  </div>
                  <ul className="max-h-72 overflow-y-auto divide-y divide-border rounded-xl">
                    {eligible.length === 0 && (
                      <li className="py-6 text-center text-xs text-muted-foreground">
                        No disputable transactions found.
                      </li>
                    )}
                    {eligible.map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => { setTxId(t.id); setErrors((e) => ({ ...e, tx: undefined })); }}
                          className="w-full flex items-center gap-3 py-3 px-1 min-h-11 text-left hover:bg-secondary/50 rounded-lg"
                        >
                          <span className="text-lg" aria-hidden="true">{t.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground truncate">{t.merchant}</span>
                            <span className="block text-xs text-muted-foreground">{formatTxDate(t.date)}</span>
                          </span>
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {money(Math.abs(t.amount))}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {errors.tx && <p className="text-xs text-destructive">{errors.tx}</p>}
            </GlassCard>

            {/* Step 2 + 3 */}
            <div className="space-y-4">
              <GlassCard className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">2. What went wrong?</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REASONS.map((r) => {
                    const active = reason === r;
                    return (
                      <button
                        key={r}
                        onClick={() => { setReason(r); setErrors((e) => ({ ...e, reason: undefined })); }}
                        aria-pressed={active}
                        className={`min-h-11 px-3 rounded-xl text-sm font-medium text-left transition-colors ${
                          active ? "bg-foreground text-background" : "bg-secondary/60 text-foreground hover:bg-secondary"
                        }`}
                      >
                        {disputeReasonLabel(r)}
                      </button>
                    );
                  })}
                </div>
                {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
              </GlassCard>

              <GlassCard className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">3. Details &amp; evidence</h2>
                <div>
                  <label htmlFor="dispute-note" className="text-xs text-muted-foreground">
                    Tell us what happened (optional unless you picked “Other”)
                  </label>
                  <textarea
                    id="dispute-note"
                    value={note}
                    onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, note: undefined })); }}
                    rows={4}
                    className="mt-1.5 w-full rounded-xl bg-secondary/60 p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
                    placeholder="e.g. I cancelled this subscription on the 3rd but was still charged."
                  />
                  {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
                </div>

                <div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full min-h-11 rounded-xl border border-dashed border-border flex items-center justify-center gap-2 text-sm font-medium text-foreground press"
                  >
                    <Paperclip size={16} aria-hidden="true" /> Attach evidence
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="sr-only"
                    aria-label="Attach supporting evidence"
                    onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Receipts, screenshots or emails. Up to 5 files, 6 MB each.
                  </p>
                  {evidence.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {evidence.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
                          <FileCheck2 size={14} className="text-success shrink-0" aria-hidden="true" />
                          <span className="text-xs text-foreground truncate flex-1">{f.name}</span>
                          <button
                            onClick={() => setEvidence((prev) => prev.filter((_, j) => j !== i))}
                            className="h-11 w-11 -my-2 flex items-center justify-center"
                            aria-label={`Remove ${f.name}`}
                          >
                            <X size={14} className="text-muted-foreground" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  onClick={submit}
                  disabled={submitting}
                  className="w-full min-h-11 rounded-xl bg-foreground text-background text-sm font-semibold press disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit dispute"}
                </button>
                <p className="text-[11px] text-muted-foreground text-center">
                  We aim to decide within 10 business days. You'll get a notification at each step.
                </p>
              </GlassCard>
            </div>
          </div>
        ) : disputes.length === 0 ? (
          <GlassCard className="text-center py-10">
            <ShieldAlert size={36} className="text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">No disputes filed</p>
            <p className="text-xs text-muted-foreground mt-1 px-6">
              Spot a charge you don't recognise? File a dispute and we'll investigate it with the merchant.
            </p>
            <button
              onClick={() => setComposing(true)}
              className="mt-4 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-foreground text-background text-sm font-semibold press"
            >
              <Plus size={16} aria-hidden="true" /> File a dispute
            </button>
          </GlassCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {disputes.map((d, i) => {
              const resolved = d.status === "resolved";
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <GlassCard className="space-y-3 h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{d.merchant}</p>
                        <p className="text-xs text-muted-foreground">{disputeReasonLabel(d.reason)}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{money(d.amount)}</span>
                    </div>

                    <StatusTracker status={d.status} />

                    <div className="flex items-center gap-2">
                      {resolved ? (
                        <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
                      ) : (
                        <Clock size={14} className="text-warning" aria-hidden="true" />
                      )}
                      <span className={`text-xs font-medium ${resolved ? "text-success" : "text-warning"}`}>
                        {DISPUTE_STATUS_LABEL[d.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">· Case {d.caseNumber}</span>
                    </div>

                    {d.note && <p className="text-xs text-muted-foreground">"{d.note}"</p>}
                    {d.evidence && d.evidence.length > 0 && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Paperclip size={12} aria-hidden="true" /> {d.evidence.length} file
                        {d.evidence.length > 1 ? "s" : ""} attached
                      </p>
                    )}

                    {d.timeline && d.timeline.length > 0 && (
                      <ul className="space-y-1.5 border-t border-border pt-2">
                        {d.timeline.map((ev, k) => (
                          <li key={k} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                            <span className="text-[11px] text-muted-foreground">
                              <span className="text-foreground font-medium">{DISPUTE_STATUS_LABEL[ev.status]}</span> ·{" "}
                              {new Date(ev.at).toLocaleDateString()} — {ev.note}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => navigate(`/transaction/${d.transactionId}`)}
                      className="text-xs font-semibold text-primary min-h-11 inline-flex items-center"
                    >
                      View transaction →
                    </button>
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
