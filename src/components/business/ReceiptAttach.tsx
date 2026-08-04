import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Loader2, FileText, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Row {
  id: string;
  path: string;
  filename: string;
  created_at: string;
}

/**
 * Attach a receipt to a transaction. Files land in the private `receipts`
 * bucket under the uploader's own folder, so the existing storage policies
 * cover access without a new rule.
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
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("transaction_receipts")
      .select("id, path, filename, created_at")
      .eq("transaction_ref", transactionRef)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }, [transactionRef]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Receipts must be under 10 MB");
    setBusy(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
      if (upErr) throw new Error(upErr.message);
      const { error } = await supabase.from("transaction_receipts").insert({
        user_id: user.id,
        transaction_ref: transactionRef,
        bank_account_id: bankAccountId ?? null,
        path,
        filename: file.name,
        content_type: file.type || null,
      });
      if (error) throw new Error(error.message);
      toast.success("Receipt attached");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
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

      {rows === null && <p className="text-xs text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No receipt yet. Attach a photo or PDF to keep your books audit-ready.
        </p>
      )}
      {(rows ?? []).map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
          <FileText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{r.filename}</span>
          <button onClick={() => view(r.path)} aria-label="View receipt" className="text-primary"><Eye size={14} /></button>
          <button onClick={() => remove(r)} aria-label="Delete receipt" className="text-destructive"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
};

export default ReceiptAttach;
