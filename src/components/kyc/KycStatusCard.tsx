import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Search,
  Sparkles,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { KycProfile, KycStatus } from "@/hooks/useKyc";
import { ledgerProvider, type ComplianceItem } from "@/lib/ledgerProvider";

type DisplayState = "unverified" | "pending" | "under_review" | "verified" | "rejected";

interface Props {
  status: KycStatus;
  profile: KycProfile | null;
  onRetry?: () => void;
  refreshing?: boolean;
  /** Compact = for gating banners; full = the dedicated verification screen. */
  variant?: "compact" | "full";
  /** Only used in compact variant. */
  reason?: string;
}

const UNDER_REVIEW_AFTER_MIN = 5;

const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
};

/**
 * Unified KYC status surface used across the verification flow and any screen
 * that gates on identity. It resolves an internal "under_review" state after
 * a pending submission has been open long enough, and shows realistic ETAs +
 * a live elapsed timer so users always know what's happening.
 */
const KycStatusCard = ({
  status,
  profile,
  onRetry,
  refreshing,
  variant = "compact",
  reason,
}: Props) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  const submittedAt = profile?.submitted_at ? new Date(profile.submitted_at).getTime() : null;
  const elapsedMs = submittedAt ? now - submittedAt : 0;
  const elapsedMin = elapsedMs / 60_000;

  const display: DisplayState =
    status === "verified"
      ? "verified"
      : status === "rejected"
      ? "rejected"
      : status === "pending" && elapsedMin >= UNDER_REVIEW_AFTER_MIN
      ? "under_review"
      : status === "pending"
      ? "pending"
      : "unverified";

  // What our banking partner still needs, straight from their compliance
  // endpoint — so a stuck application says exactly what's missing. The partner
  // reports four distinct per-field statuses and they mean different things to
  // the customer: `invalid` needs correcting, `missing` needs providing, and
  // `pending` needs nothing at all but patience.
  const [requirements, setRequirements] = useState<ComplianceItem[]>([]);
  useEffect(() => {
    if (display === "verified" || display === "unverified") { setRequirements([]); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await ledgerProvider.myCompliance();
        if (cancelled) return;
        setRequirements((res.requirements ?? []).filter((r) => r.status !== "complete"));
      } catch { /* the status card must render even if compliance is unreachable */ }
    })();
    return () => { cancelled = true; };
  }, [display, status]);


  useEffect(() => {
    if (display !== "pending" && display !== "under_review") return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [display]);

  const cfg = {
    unverified: {
      Icon: ShieldAlert,
      tone: "warning",
      title: "Identity verification required",
      body: reason ?? "Verify your identity to unlock transfers, cards, and payments.",
      eta: "Takes about 3 minutes",
      cta: "Start verification",
      ctaTo: "/profile/verify",
      steps: ["Submit", "Review", "Approved"],
      stepIdx: 0,
    },
    pending: {
      Icon: Clock,
      tone: "info",
      title: "We received your info",
      body: "Automated checks are running now. Most people are approved in under 2 minutes.",
      eta: `Usually done within 2 min · submitted ${fmtElapsed(elapsedMs)}`,
      cta: "Refresh status",
      ctaTo: null,
      steps: ["Submitted", "Automated checks", "Approved"],
      stepIdx: 1,
    },
    under_review: {
      Icon: Search,
      tone: "info",
      title: "A specialist is reviewing your submission",
      body:
        "Your application needs a closer look. Reviews typically complete within 1 hour during business hours, and up to 24 hours otherwise. We'll notify you as soon as a decision is made.",
      eta: `Typical decision within 1 hour · submitted ${fmtElapsed(elapsedMs)}`,
      cta: "Refresh status",
      ctaTo: null,
      steps: ["Submitted", "Manual review", "Decision"],
      stepIdx: 1,
    },
    verified: {
      Icon: ShieldCheck,
      tone: "success",
      title: "You're verified",
      body: profile
        ? `Verified as ${profile.legal_first_name} ${profile.legal_last_name}. All banking features are unlocked.`
        : "Your identity is verified. All banking features are unlocked.",
      eta: profile?.reviewed_at ? `Approved ${fmtElapsed(now - new Date(profile.reviewed_at).getTime())}` : "",
      cta: "Continue",
      ctaTo: "/",
      steps: ["Submitted", "Reviewed", "Approved"],
      stepIdx: 2,
    },
    rejected: {
      Icon: ShieldAlert,
      tone: "destructive",
      title: "Verification wasn't approved",
      body:
        profile?.rejection_reason ??
        "We couldn't approve your submission. Update the flagged details and resubmit — most people are approved on the second try.",
      eta: profile?.reviewed_at ? `Reviewed ${fmtElapsed(now - new Date(profile.reviewed_at).getTime())}` : "",
      cta: "Update & resubmit",
      ctaTo: "/profile/verify",
      steps: ["Submitted", "Reviewed", "Needs changes"],
      stepIdx: 2,
    },
  }[display];

  const toneClasses =
    cfg.tone === "destructive"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : cfg.tone === "warning"
      ? "bg-warning/10 text-warning-foreground border-warning/20"
      : cfg.tone === "success"
      ? "bg-success/10 text-success border-success/20"
      : "bg-primary/10 text-primary border-primary/20";

  const dotFor = (i: number) =>
    i < cfg.stepIdx
      ? "bg-success"
      : i === cfg.stepIdx
      ? display === "rejected"
        ? "bg-destructive"
        : display === "verified"
        ? "bg-success"
        : "bg-primary animate-pulse"
      : "bg-muted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border p-5 ${toneClasses} ${variant === "full" ? "space-y-5" : "space-y-4"}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-background/60 flex items-center justify-center shrink-0">
          <cfg.Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-display font-bold">{cfg.title}</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/60 font-semibold">
              {display.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm mt-1.5 opacity-90">{cfg.body}</p>
          {cfg.eta && (
            <p className="text-xs mt-2 opacity-70 flex items-center gap-1.5">
              <Sparkles size={12} /> {cfg.eta}
            </p>
          )}
        </div>
      </div>

      {requirements.length > 0 && (
        <div className="rounded-2xl bg-background/60 p-3.5 space-y-1.5">
          <p className="text-xs font-semibold">Still needed by our banking partner</p>
          <ul className="space-y-1">
            {requirements.map((r) => (
              <li key={r} className="text-xs opacity-80 flex gap-2">
                <span aria-hidden>•</span><span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress rail */}
      <div className="flex items-center gap-2">
        {cfg.steps.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${dotFor(i)}`} />
            <p className="text-[10px] mt-1.5 opacity-70 font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {cfg.ctaTo ? (
          <button
            onClick={() => navigate(cfg.ctaTo!)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-background text-foreground text-sm font-semibold flex items-center justify-center gap-1.5"
          >
            {cfg.cta} <ArrowRight size={14} />
          </button>
        ) : (
          onRetry && (
            <button
              onClick={onRetry}
              disabled={refreshing}
              className="flex-1 py-2.5 px-4 rounded-xl bg-background text-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Checking…" : cfg.cta}
            </button>
          )
        )}
      </div>
    </motion.div>
  );
};

export default KycStatusCard;
