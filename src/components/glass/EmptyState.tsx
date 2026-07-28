import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "ghost";
}

interface EmptyStateProps {
  /** Lucide icon rendered inside the branded tile. */
  icon?: LucideIcon;
  /** Emoji alternative when an icon would feel too clinical. */
  emoji?: string;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  /** Small helper line under the actions (e.g. "Updated every hour"). */
  footnote?: string;
  className?: string;
}

/**
 * The single on-brand empty state used by every list surface in the app.
 * A brand-new customer with zero activity should always land on one of these —
 * never a blank card, never a spinner that spins forever.
 */
const EmptyState = ({
  icon: Icon,
  emoji,
  title,
  description,
  actions = [],
  footnote,
  className = "",
}: EmptyStateProps) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <GlassCard className={`text-center py-10 px-6 ${className}`}>
      <div className="w-14 h-14 rounded-2xl gradient-hero mx-auto flex items-center justify-center mb-3">
        {Icon ? (
          <Icon size={24} className="text-primary-foreground" />
        ) : (
          <span className="text-2xl">{emoji ?? "✨"}</span>
        )}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[34ch] mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-transform active:scale-95 ${
                a.variant === "ghost"
                  ? "bg-secondary text-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      {footnote && <p className="text-[11px] text-muted-foreground mt-3">{footnote}</p>}
    </GlassCard>
  </motion.div>
);

export default EmptyState;
