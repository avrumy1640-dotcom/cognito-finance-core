import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Delete, CheckCircle2, Lock } from "lucide-react";
import FlowScreen, { FlowButton } from "@/components/layout/FlowScreen";
import GlassCard from "@/components/glass/GlassCard";
import { useCardPrefs } from "@/hooks/useCardPrefs";

const WEAK = new Set(["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321"]);

const ChangePin = () => {
  const navigate = useNavigate();
  const { update } = useCardPrefs();
  const [stage, setStage] = useState<"enter" | "confirm" | "done">("enter");
  const [pin, setPin] = useState("");
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  const press = (d: string) => {
    if (entry.length >= 4) return;
    const next = entry + d;
    setError(null);
    setEntry(next);
    if (next.length === 4) setTimeout(() => commit(next), 140);
  };

  const commit = (value: string) => {
    if (stage === "enter") {
      if (WEAK.has(value)) {
        setError("Pick a less predictable PIN");
        setEntry("");
        return;
      }
      setPin(value);
      setEntry("");
      setStage("confirm");
      return;
    }
    if (value !== pin) {
      setError("PINs didn't match. Start again.");
      setEntry("");
      setPin("");
      setStage("enter");
      return;
    }
    update({ pinUpdatedAt: new Date().toISOString() });
    setStage("done");
    toast.success("PIN updated", { description: "Effective on your next card use" });
  };

  const backspace = () => {
    setError(null);
    setEntry((e) => e.slice(0, -1));
  };

  if (stage === "done") {
    return (
      <FlowScreen title="PIN updated" kicker="Card" backTo="/cards">
        <GlassCard elevated className="text-center py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-success/10 mx-auto flex items-center justify-center">
            <CheckCircle2 size={26} className="text-success" />
          </div>
          <p className="text-base font-semibold text-foreground">Your new PIN is active</p>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            Use it at ATMs and chip terminals from your next transaction. Never share it with anyone —
            we'll never ask for it.
          </p>
        </GlassCard>
        <FlowButton onClick={() => navigate("/cards")}>Back to cards</FlowButton>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title="Change PIN"
      kicker="Card"
      subtitle={stage === "enter" ? "Choose a new 4-digit PIN." : "Enter it once more to confirm."}
    >
      <GlassCard className="py-8 flex flex-col items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock size={20} className="text-primary" />
        </div>
        <div className="flex gap-3" role="status" aria-label={`${entry.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-colors ${
                i < entry.length ? "bg-primary" : "bg-secondary border border-border"
              }`}
            />
          ))}
        </div>
        {error && <p className="text-xs font-medium text-destructive text-center px-4">{error}</p>}
      </GlassCard>

      <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto w-full">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        <div />
        <Key onClick={() => press("0")}>0</Key>
        <Key onClick={backspace} label="Delete last digit">
          <Delete size={20} />
        </Key>
      </div>
    </FlowScreen>
  );
};

const Key = ({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label?: string;
}) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="h-16 rounded-2xl bg-secondary text-xl font-display font-semibold text-foreground flex items-center justify-center press hover:bg-secondary/70 transition-colors"
  >
    {children}
  </button>
);

export default ChangePin;
