import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface FlowScreenProps {
  title: string;
  kicker?: string;
  subtitle?: string;
  children: ReactNode;
  /** Sticky footer action area (primary CTA etc.). */
  footer?: ReactNode;
  backTo?: string;
}

/**
 * Shell for dedicated multi-step flows (Replace card, Change PIN, …).
 * Always has a real back button and its own header, so a flow never feels
 * like a modal bolted onto another screen.
 */
const FlowScreen = ({ title, kicker, subtitle, children, footer, backTo }: FlowScreenProps) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 pb-4 flex items-start gap-3">
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          aria-label="Go back"
          className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <div className="min-w-0 pt-1.5">
          {kicker && (
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">{kicker}</p>
          )}
          <h1 className="text-[22px] font-display font-bold text-foreground leading-tight tracking-tight break-words">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 leading-snug">{subtitle}</p>}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 px-5 sm:px-6 lg:px-0 space-y-4 pb-8"
      >
        {children}
      </motion.div>

      {footer && (
        <div className="sticky bottom-24 lg:bottom-6 z-10 px-5 sm:px-6 lg:px-0 py-4 bg-gradient-to-t from-background via-background to-transparent">
          {footer}
        </div>
      )}
    </div>

  );
};

/** Full-width primary action with consistent height, padding and truncation. */
export const FlowButton = ({
  children,
  onClick,
  disabled,
  tone = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "destructive";
  type?: "button" | "submit";
}) => {
  const toneClass =
    tone === "destructive"
      ? "bg-destructive text-destructive-foreground"
      : tone === "secondary"
      ? "bg-secondary text-foreground"
      : "bg-primary text-primary-foreground";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[52px] px-5 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug transition-opacity disabled:opacity-50 press ${toneClass}`}
    >
      {children}
    </button>
  );
};

export default FlowScreen;
