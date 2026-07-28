import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import FlowScreen, { FlowButton } from "@/components/layout/FlowScreen";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";

const REASONS = [
  { key: "lost", label: "I lost it", desc: "Misplaced, but no sign of fraud" },
  { key: "stolen", label: "It was stolen", desc: "Taken from me or my belongings" },
  { key: "fraud", label: "I see charges I didn't make", desc: "We'll open a dispute too" },
] as const;

const ReportCard = () => {
  const navigate = useNavigate();
  const { card, reportStolen } = useBank();
  const [step, setStep] = useState<"reason" | "confirm" | "done">("reason");
  const [reason, setReason] = useState<string>("lost");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await reportStolen();
    setBusy(false);
    setStep("done");
    toast.success("Card permanently blocked");
  };

  if (step === "done") {
    return (
      <FlowScreen title="Card blocked" kicker="Card security" backTo="/cards">
        <GlassCard elevated className="text-center py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-success/10 mx-auto flex items-center justify-center">
            <CheckCircle2 size={26} className="text-success" />
          </div>
          <p className="text-base font-semibold text-foreground">
            •••• {card?.last4 ?? "————"} can no longer be used
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            No new charges will go through. A replacement is being prepared and our fraud team will
            review recent activity.
          </p>
        </GlassCard>
        <FlowButton onClick={() => navigate("/disputes")} tone="secondary">
          Dispute a charge
        </FlowButton>
        <FlowButton onClick={() => navigate("/cards")}>Back to cards</FlowButton>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title="Report lost or stolen"
      kicker="Card security"
      subtitle={
        step === "reason"
          ? "This permanently blocks your card. Pick what happened."
          : "Read this carefully — it can't be undone."
      }
      footer={
        step === "reason" ? (
          <FlowButton onClick={() => setStep("confirm")}>Continue</FlowButton>
        ) : (
          <div className="space-y-2">
            <FlowButton tone="destructive" onClick={submit} disabled={busy}>
              {busy ? "Blocking card…" : "Yes, block this card"}
            </FlowButton>
            <FlowButton tone="secondary" onClick={() => setStep("reason")}>
              Go back
            </FlowButton>
          </div>
        )
      }
    >
      {step === "reason" ? (
        <GlassCard className="p-0 overflow-hidden divide-y divide-border">
          {REASONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className="w-full flex items-start justify-between gap-3 px-4 py-3.5 min-h-[56px] text-left hover:bg-secondary/40 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground leading-snug">{r.label}</span>
                <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{r.desc}</span>
              </span>
              <span
                className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 ${
                  reason === r.key ? "border-primary bg-primary" : "border-border"
                }`}
              />
            </button>
          ))}
        </GlassCard>
      ) : (
        <>
          <GlassCard className="flex items-start gap-3 border border-destructive/30">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">This is permanent</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Card •••• {card?.last4 ?? "————"} will be closed immediately. Subscriptions and saved
                checkouts using it will start failing.
              </p>
            </div>
          </GlassCard>
          <GlassCard className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-primary" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed min-w-0">
              You're covered by zero-liability protection for unauthorized charges. A replacement card
              ships automatically once the block is in place.
            </p>
          </GlassCard>
          <p className="text-xs text-muted-foreground px-1">
            Reported reason: {REASONS.find((r) => r.key === reason)?.label}
          </p>
        </>
      )}
    </FlowScreen>
  );
};

export default ReportCard;
