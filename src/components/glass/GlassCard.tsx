import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
}

const GlassCard = ({ children, className, elevated, onClick }: GlassCardProps) => (
  <div
    onClick={onClick}
    className={cn(
      "rounded-2xl p-4",
      elevated ? "glass-card-elevated" : "glass-card",
      onClick && "cursor-pointer active:scale-[0.98] transition-transform duration-150",
      className
    )}
  >
    {children}
  </div>
);

export default GlassCard;
