import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { useKyc } from "@/hooks/useKyc";

interface Props {
  children?: ReactNode;
  /** Message shown above the CTA when unverified. */
  reason?: string;
}

/**
 * Blocks children until the user's KYC profile is verified.
 * Renders an inline banner + CTA for pending/unverified/rejected states.
 */
const RequireKyc = ({ children, reason = "Verify your identity to move money" }: Props) => {
  const { status, loading, profile } = useKyc();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === "verified") return <>{children}</>;

  const config = {
    unverified: {
      icon: ShieldAlert,
      title: "Identity verification required",
      body: reason,
      cta: "Verify identity",
      tone: "warning" as const,
    },
    pending: {
      icon: Clock,
      title: "Verification in review",
      body: "We're reviewing your submission. This usually takes a few minutes.",
      cta: "Check status",
      tone: "info" as const,
    },
    rejected: {
      icon: ShieldAlert,
      title: "Verification needs attention",
      body: profile?.rejection_reason ?? "We couldn't verify your identity. Please re-submit.",
      cta: "Update and resubmit",
      tone: "destructive" as const,
    },
    verified: {
      icon: ShieldCheck,
      title: "Verified",
      body: "",
      cta: "",
      tone: "success" as const,
    },
  }[status];

  const toneClasses =
    config.tone === "destructive" ? "bg-destructive/10 text-destructive"
      : config.tone === "warning" ? "bg-warning/10 text-warning-foreground"
      : "bg-primary/10 text-primary";

  return (
    <div className="px-5 pt-14 space-y-4">
      <div className={`rounded-2xl p-5 ${toneClasses}`}>
        <div className="flex items-start gap-3">
          <config.icon size={22} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-base font-display font-bold">{config.title}</h3>
            <p className="text-sm mt-1 opacity-90">{config.body}</p>
            <button
              onClick={() => navigate("/profile/verify")}
              className="mt-4 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              {config.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequireKyc;
