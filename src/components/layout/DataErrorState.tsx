import { AlertTriangle, RefreshCw } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";

interface Props {
  message?: string | null;
  onRetry: () => void;
  title?: string;
}

/**
 * Honest failure state. We never fabricate balances — when the backend can't be
 * reached the screen says so and offers a retry.
 */
const DataErrorState = ({ message, onRetry, title = "We couldn't load your account" }: Props) => (
  <GlassCard className="text-center py-10 px-6">
    <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
      <AlertTriangle size={22} className="text-destructive" />
    </div>
    <p className="text-sm font-semibold text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
      {message || "Your bank didn't respond. No balances are shown until we can confirm them."}
    </p>
    <button
      onClick={onRetry}
      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold press"
    >
      <RefreshCw size={14} /> Tap to retry
    </button>
  </GlassCard>
);

export default DataErrorState;
