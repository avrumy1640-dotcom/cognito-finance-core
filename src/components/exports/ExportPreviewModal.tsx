import { motion } from "framer-motion";
import { FileText, Download, Copy, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { humanBytes, type ExportResult } from "@/lib/exports";

interface Props {
  result: ExportResult | null;
  onClose: () => void;
}

const ExportPreviewModal = ({ result, onClose }: Props) => {
  if (!result) return null;
  const isPdf = result.mime === "application/pdf";
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-3xl p-5 max-h-[90vh] overflow-y-auto safe-bottom"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Export ready</p>
            <h2 className="text-lg font-display font-bold text-foreground mt-1">{result.filename}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center" aria-label="Close">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <GlassCard className="mb-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Format</span>
            <span className="font-semibold text-foreground">{isPdf ? "PDF" : "CSV"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Rows</span>
            <span className="font-semibold text-foreground">{result.rows.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Size</span>
            <span className="font-semibold text-foreground">{humanBytes(result.size)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Confirmation</span>
            <button
              onClick={async () => { await navigator.clipboard.writeText(result.confirmationCode); toast.success("Confirmation copied"); }}
              className="font-mono text-xs text-primary flex items-center gap-1"
            >
              {result.confirmationCode}
              <Copy size={12} />
            </button>
          </div>
        </GlassCard>

        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Preview</p>
          <pre className="text-[11px] font-mono bg-secondary rounded-xl p-3 max-h-52 overflow-auto whitespace-pre-wrap break-all text-foreground">
{result.previewText || "No rows to preview."}
          </pre>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4">
          <ShieldCheck size={12} className="text-success" />
          <span>Keep this confirmation for your records — auditable download reference.</span>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={() => { result.download(); toast.success("Download started", { description: result.filename }); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Download size={16} /> Download
          </button>
        </div>
        {result.rows === 0 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-warning">
            <FileText size={12} /> This report is empty — nothing matched your current filters.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default ExportPreviewModal;
