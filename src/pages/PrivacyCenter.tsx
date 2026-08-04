import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileCheck2,
  Loader2,
  ShieldAlert,
  Trash2,
  Lock,
  ExternalLink,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Consent = {
  tos_accepted_at: string | null;
  privacy_accepted_at: string | null;
  onboarded_at: string | null;
};

type RetentionItem = { table: string; reason: string };

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

const PrivacyCenter = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [consent, setConsent] = useState<Consent | null>(null);
  const [retention, setRetention] = useState<RetentionItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const [{ data: profile, error: profileError }, policy] = await Promise.all([
        supabase
          .from("profiles")
          .select("tos_accepted_at, privacy_accepted_at, onboarded_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.functions.invoke("privacy", { body: { action: "retention_policy" } }),
      ]);
      if (cancelled) return;
      // Surface a real read failure instead of rendering a silent blank card.
      if (profileError) toast.error("Couldn't load your consent records");
      setConsent(profile ?? null);
      const items = (policy.data as { retained?: RetentionItem[] } | null)?.retained;
      if (Array.isArray(items)) setRetention(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const runExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("privacy", { body: { action: "export" } });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `glass-bank-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded");
    } catch (e) {
      toast.error((e as Error).message || "Export failed — please try again");
    } finally {
      setExporting(false);
    }
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("privacy", {
        body: { action: "delete_account", confirmation: confirmText },
      });
      if (error) throw error;
      const payload = data as { error?: string; message?: string } | null;
      if (payload?.error) throw new Error(payload.error);
      toast.success(payload?.message ?? "Your account is closed");
      await supabase.auth.signOut();
      navigate("/welcome", { replace: true });
    } catch (e) {
      toast.error((e as Error).message || "We couldn't close your account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-0 pt-6 pb-10 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Privacy Center</h1>
            <p className="text-sm text-muted-foreground">Your data, your consents, and your right to leave</p>
          </div>
        </div>

        {/* Consent records */}
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck2 size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Consent records</h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Timestamped records of the agreements you accepted. These are stored on your account and
            can be produced on request.
          </p>
          <div className="divide-y divide-border rounded-xl bg-secondary/50">
            <ConsentRow label="Terms of Service accepted" value={fmt(consent?.tos_accepted_at ?? null)} />
            <ConsentRow label="Privacy Policy accepted" value={fmt(consent?.privacy_accepted_at ?? null)} />
            <ConsentRow label="Onboarding completed" value={fmt(consent?.onboarded_at ?? null)} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => navigate("/legal/terms")}
              className="btn-full inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-foreground"
            >
              Read Terms <ExternalLink size={12} />
            </button>
            <button
              onClick={() => navigate("/legal/privacy")}
              className="btn-full inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-foreground"
            >
              Read Privacy Policy <ExternalLink size={12} />
            </button>
          </div>
        </GlassCard>

        {/* Export */}
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Download your data</h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A complete, machine-readable copy of everything we hold about you — profile, identity
            verification, accounts, transactions, payees, invoices, notifications, devices, support
            history and your audit trail. Delivered as a JSON file, immediately.
          </p>
          <button
            onClick={runExport}
            disabled={exporting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? "Preparing your export…" : "Download my data"}
          </button>
        </GlassCard>

        {/* Retention notice */}
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">What we can't delete, and why</h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            We are a regulated financial application. The Bank Secrecy Act requires us to keep certain
            records for five years after your account closes. We will not promise you an erasure we
            are not legally permitted to perform.
          </p>
          {retention.length > 0 ? (
            <ul className="space-y-2">
              {retention.map((r) => (
                <li key={r.table} className="rounded-xl bg-secondary/50 px-3 py-2">
                  <p className="text-xs font-medium text-foreground">{r.table.replace(/_/g, " ")}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{r.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Loading retention schedule…</p>
          )}
        </GlassCard>

        {/* Delete */}
        <GlassCard className="space-y-3 border-destructive/30">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">Close and delete my account</h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This permanently disables sign-in and erases your preferences, saved payees, trusted
            devices, notification history and uploaded receipts. Financial and identity records are
            retained as listed above. Your balance must be zero first.
          </p>

          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 px-5 text-sm font-semibold text-destructive"
            >
              <Trash2 size={16} /> Start account deletion
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex gap-2">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-destructive" />
                <p className="text-xs leading-relaxed text-foreground">
                  This cannot be undone. You will lose access to your transaction history in the app,
                  and you will not be able to sign in again with this email.
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-foreground">
                  Type <span className="font-mono">DELETE MY ACCOUNT</span> to confirm
                </span>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-destructive"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={runDelete}
                  disabled={deleting || confirmText.trim().toUpperCase() !== "DELETE MY ACCOUNT"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {deleting && <Loader2 size={16} className="animate-spin" />}
                  {deleting ? "Closing your account…" : "Permanently close my account"}
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setConfirmText("");
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-secondary px-5 text-sm font-semibold text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </AppLayout>
  );
};

const ConsentRow = ({ label, value }: { label: string; value: string | null }) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-xs font-medium ${value ? "text-foreground" : "text-muted-foreground"}`}>
      {value ?? "Not recorded"}
    </span>
  </div>
);

export default PrivacyCenter;
