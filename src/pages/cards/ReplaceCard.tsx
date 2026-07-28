import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Truck, CreditCard } from "lucide-react";
import FlowScreen, { FlowButton } from "@/components/layout/FlowScreen";
import GlassCard from "@/components/glass/GlassCard";
import AddressAutocomplete from "@/components/form/AddressAutocomplete";
import { useBank } from "@/store/bankStore";
import { useCardPrefs } from "@/hooks/useCardPrefs";

const REASONS = [
  { key: "damaged", label: "Damaged or worn", desc: "Chip or magstripe stopped working" },
  { key: "expiring", label: "Expiring soon", desc: "Get ahead of the expiry date" },
  { key: "name", label: "Name change", desc: "Reissue with an updated name" },
  { key: "other", label: "Another reason", desc: "We'll still ship a fresh card" },
] as const;

const etaRange = () => {
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const a = new Date();
  a.setDate(a.getDate() + 5);
  const b = new Date();
  b.setDate(b.getDate() + 7);
  return `${fmt(a)} – ${fmt(b)}`;
};

const ReplaceCard = () => {
  const navigate = useNavigate();
  const { card, replaceCard } = useBank();
  const { prefs, update } = useCardPrefs();

  const [step, setStep] = useState<"reason" | "address" | "review" | "done">("reason");
  const [reason, setReason] = useState<string>("damaged");
  const [address, setAddress] = useState(prefs.shipToOverride ?? "");
  const [busy, setBusy] = useState(false);

  const eta = etaRange();

  const submit = async () => {
    setBusy(true);
    await replaceCard();
    update({ shipToOverride: address });
    setBusy(false);
    setStep("done");
    toast.success("Replacement card ordered");
  };

  if (step === "done") {
    return (
      <FlowScreen title="Replacement on the way" kicker="Card" backTo="/cards">
        <GlassCard elevated className="text-center py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-success/10 mx-auto flex items-center justify-center">
            <CheckCircle2 size={26} className="text-success" />
          </div>
          <p className="text-base font-semibold text-foreground">Your new card is being printed</p>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            Estimated arrival <span className="font-semibold text-foreground">{eta}</span>. Your current
            card keeps working until you activate the new one.
          </p>
        </GlassCard>
        <GlassCard className="space-y-2">
          <Row label="Shipping to" value={address || "Address on file"} />
          <Row label="Delivery" value="Standard mail · free" />
          <Row label="Card" value={`•••• ${card?.last4 ?? "————"}`} />
        </GlassCard>
        <FlowButton onClick={() => navigate("/cards")}>Back to cards</FlowButton>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title="Replace card"
      kicker="Card"
      subtitle={
        step === "reason"
          ? "Tell us why so we ship the right card."
          : step === "address"
          ? "Confirm where the new card should arrive."
          : "One last look before we print it."
      }
      footer={
        <FlowButton
          onClick={() => {
            if (step === "reason") setStep("address");
            else if (step === "address") {
              if (address.trim().length < 6) {
                toast.error("Enter a shipping address");
                return;
              }
              setStep("review");
            } else void submit();
          }}
          disabled={busy}
        >
          {step === "review" ? (busy ? "Ordering…" : "Order replacement") : "Continue"}
        </FlowButton>
      }
    >
      {step === "reason" && (
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
      )}

      {step === "address" && (
        <GlassCard className="space-y-3">
          <AddressAutocomplete
            label="Ship to"
            value={address}
            onChange={setAddress}
            onSelect={(s) => setAddress(s.label ?? address)}
            placeholder="Start typing your address"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            We only ship to addresses in your verified country. Delivery is free and tracked.
          </p>
        </GlassCard>
      )}

      {step === "review" && (
        <>
          <GlassCard className="space-y-2">
            <Row label="Reason" value={REASONS.find((r) => r.key === reason)?.label ?? ""} />
            <Row label="Ship to" value={address} />
            <Row label="Card" value={`${card?.network ?? "Visa"} •••• ${card?.last4 ?? "————"}`} />
          </GlassCard>
          <GlassCard className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Truck size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Arrives {eta}</p>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                Your current card stays active until the replacement is activated.
              </p>
            </div>
          </GlassCard>
          <GlassCard className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <CreditCard size={18} className="text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed min-w-0">
              Recurring payments tied to the old card number will need updating once the new card is active.
            </p>
          </GlassCard>
        </>
      )}
    </FlowScreen>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 py-1">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className="text-sm font-medium text-foreground text-right break-words min-w-0">{value}</span>
  </div>
);

export default ReplaceCard;
