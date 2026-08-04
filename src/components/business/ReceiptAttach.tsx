import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Loader2, FileText, Trash2, Eye, Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Row {
  id: string;
  path: string;
  filename: string;
  note: string | null;
  created_at: string;
}

interface Suggestion {
  receiptId: string;
  merchant: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  category: string | null;
  summary: string | null;
}

const money = (v: number, ccy: string | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD" }).format(v);

/**
 * Attach a receipt to a transaction. Files land in the private `receipts`
 * bucket under the uploader's own folder, so the existing storage policies
 * cover access without a new rule.
 *
 * After upload we run the receipt through OCR and offer what it read back as a
 * *suggestion*. Nothing is written to the transaction until the user presses
 * confirm — a misread receipt can never silently recategorise their books.
 */
const ReceiptAttach = ({
  transactionRef,
  bankAccountId,
}: {
  transactionRef: string;
  bankAccountId?: string | null;
}) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("transaction_receipts")
      .select("id, path, filename, note, created_at")
      .eq("transaction_ref", transactionRef)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }, [transactionRef]);

  useEffect(() => { void load(); }, [load]);

  /** Best-effort OCR pass. A failure here never invalidates the upload. */
  const scan = async (receiptId: string, path: string, contentType: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("receipt-ocr", {
        body: { path, contentType },
      });
      if (error) throw new Error(error.message);
      const s = data?.suggestion;
      if (!s || (!s.merchant && !s.total && !s.date)) {
        toast.info("Couldn't read details off that receipt — you can still attach it.");
        return;
      }
      setSuggestion({ receiptId, ...s });
    } catch {
      toast.info("Receipt saved. Automatic reading wasn't available this time.");
    } finally {
      setScanning(false);
    }
  };

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Receipts must be under 10 MB");
    setBusy(true);
    setSuggestion(null);
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
      if (upErr) throw new Error(upErr.message);
      const { data: inserted, error } = await supabase.from("transaction_receipts").insert({
        user_id: user.id,
        transaction_ref: transactionRef,
        bank_account_id: bankAccountId ?? null,
        path,
        filename: file.name,
        content_type: file.type || null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      toast.success("Receipt attached");
      await load();
      void scan(inserted.id, path, file.type || "image/jpeg");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** Apply the OCR reading: a note on the receipt and a category override. */
  const applySuggestion = async () => {
    if (!suggestion || !user) return;
    const s = suggestion;
    const parts = [
      s.merchant,
      s.total != null ? money(s.total, s.currency) : null,
      s.date,
      s.summary,
    ].filter(Boolean);
    try {
      await supabase.from("transaction_receipts")
        .update({ note: parts.join(" · ").slice(0, 300) })
        .eq("id", s.receiptId);

      if (s.category) {
        await supabase.from("transaction_categories").upsert({
          user_id: user.id,
          transaction_ref: transactionRef,
          category: s.category,
          merchant_normalized: s.merchant ?? null,
          is_override: true,
        }, { onConflict: "user_id,transaction_ref" });
      }
      toast.success("Receipt details applied");
      setSuggestion(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save details");
    }
  };

  const view = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    else toast.error("Receipt unavailable");
  };

  const remove = async (row: Row) => {
    const { error } = await supabase.from("transaction_receipts").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("receipts").remove([row.path]);
    if (suggestion?.receiptId === row.id) setSuggestion(null);
    toast.success("Receipt removed");
    void load();
  };

  const count = rows?.length ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Paperclip size={16} className="text-primary" />
          Receipts {count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-xs font-semibold text-primary flex items-center gap-1 disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />} Attach
        </button>
        <input
          ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>

      {scanning && (
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Reading receipt…</span>
        </div>
      )}

      {suggestion && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Sparkles size={13} /> Read from your receipt
          </p>
          <dl className="space-y-1 text-xs">
            {suggestion.merchant && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Merchant</dt>
                <dd className="text-foreground text-right truncate">{suggestion.merchant}</dd>
              </div>
            )}
            {suggestion.total != null && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-foreground">{money(suggestion.total, suggestion.currency)}</dd>
              </div>
            )}
            {suggestion.date && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Date</dt>
                <dd className="text-foreground">{suggestion.date}</dd>
              </div>
            )}
            {suggestion.category && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="text-foreground">{suggestion.category}</dd>
              </div>
            )}
          </dl>
          <div className="flex gap-2 pt-1">
            <button
              onClick={applySuggestion}
              className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground flex items-center justify-center gap-1"
            >
              <Check size={13} /> Apply
            </button>
            <button
              onClick={() => setSuggestion(null)}
              className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1"
            >
              <X size={13} /> Dismiss
            </button>
          </div>
        </div>
      )}

      {rows === null && <p className="text-xs text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No receipt yet. Attach a photo or PDF to keep your books audit-ready.
        </p>
      )}
      {(rows ?? []).map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
          <FileText size={14} className="text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-foreground truncate">{r.filename}</p>
            {r.note && <p className="text-[11px] text-muted-foreground truncate">{r.note}</p>}
          </div>
          <button onClick={() => view(r.path)} aria-label="View receipt" className="text-primary"><Eye size={14} /></button>
          <button onClick={() => remove(r)} aria-label="Delete receipt" className="text-destructive"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
};

export default ReceiptAttach;
