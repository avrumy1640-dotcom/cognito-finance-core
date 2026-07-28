import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import FlowScreen, { FlowButton } from "@/components/layout/FlowScreen";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { useKyc } from "@/hooks/useKyc";

const USES = [
  { key: "online", label: "Online shopping", desc: "One card for everyday e-commerce" },
  { key: "subscriptions", label: "Subscriptions", desc: "Keep recurring billing separate" },
  { key: "travel", label: "Travel bookings", desc: "Isolate large one-off charges" },
] as const;

const VirtualCard = () => {
  const navigate = useNavigate();
  const { issueCard, card } = useBank();
  const { canMoveMoney } = useKyc();
  const [use, setUse] = useState<string>("online");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(false);

  const submit = async () => {
    if (!canMoveMoney) {
      toast.error("Verify your identity to issue a new card.");
      navigate("/profile/verify");
      return;
    }
    setBusy(true);
    const ok = await issueCard({ type: "virtual" });
    setBusy(false);
    if (!ok) {
      toast.error("We couldn't issue that card. Try again.");
      return;
    }
    setIssued(true);
    toast.success("Virtual card issued");
  };

  if (issued) {
    const last4 = card?.last4 ?? "0000";
    return (
      <FlowScreen title="Virtual card ready" kicker="Card" backTo="/cards">
        <GlassCard elevated className="text-center py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-success/10 mx-auto flex items-center justify-center">
            <CheckCircle2 size={26} className="text-success" />
          </div>
          <p className="text-base font-semibold text-foreground">Card •••• {last4} is live</p>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            Use it immediately online. You can freeze or delete it anytime without touching your
            physical card.
          </p>
        </GlassCard>
        <FlowButton
          tone="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`482918472946${last4}`);
              toast.success("Card number copied");
            } catch {
              toast.error("Copy failed");
            }
          }}
        >
          <Copy size={16} /> Copy card number
        </FlowButton>
        <FlowButton onClick={() => navigate("/cards")}>Back to cards</FlowButton>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title="Issue a virtual card"
      kicker="Card"
      subtitle="Ready in seconds, spendable online right away."
      footer={
        <FlowButton onClick={submit} disabled={busy}>
          {busy ? "Issuing…" : "Issue virtual card"}
        </FlowButton>
      }
    >
      <GlassCard className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-primary" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed min-w-0">
          Virtual cards share your balance but have their own number, so you can cancel one without
          reissuing your physical card.
        </p>
      </GlassCard>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
          What's it for?
        </p>
        <GlassCard className="p-0 overflow-hidden divide-y divide-border">
          {USES.map((u) => (
            <button
              key={u.key}
              onClick={() => setUse(u.key)}
              className="w-full flex items-start justify-between gap-3 px-4 py-3.5 min-h-[56px] text-left hover:bg-secondary/40 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground leading-snug">{u.label}</span>
                <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{u.desc}</span>
              </span>
              <span
                className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 ${
                  use === u.key ? "border-primary bg-primary" : "border-border"
                }`}
              />
            </button>
          ))}
        </GlassCard>
      </div>

      <GlassCard className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-success" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed min-w-0">
          No fee, no credit check, and the same zero-liability fraud protection as your physical card.
        </p>
      </GlassCard>
    </FlowScreen>
  );
};

export default VirtualCard;
