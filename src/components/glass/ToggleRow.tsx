import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ToggleRowProps {
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Canonical on/off row: the whole row is the label, the switch is a real
 * Switch that flips in place. Never a popup, never a toast-only action.
 *
 * Text wraps rather than clipping, and the row keeps a 44px minimum height
 * so the tap target is always comfortable.
 */
const ToggleRow = ({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
  disabled,
  className,
}: ToggleRowProps) => (
  <label
    className={cn(
      "flex items-start justify-between gap-3 px-4 py-3.5 min-h-[56px] cursor-pointer transition-colors hover:bg-secondary/40",
      disabled && "opacity-60 cursor-not-allowed",
      className
    )}
  >
    <span className="flex items-start gap-3 min-w-0 flex-1">
      {Icon && (
        <span
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
            checked ? "bg-primary/10" : "bg-secondary"
          )}
        >
          <Icon size={18} className={checked ? "text-primary" : "text-muted-foreground"} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground leading-snug break-words">{label}</span>
        {desc && (
          <span className="block text-xs text-muted-foreground leading-snug mt-0.5 break-words">{desc}</span>
        )}
      </span>
    </span>
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={label}
      className="mt-1 shrink-0"
    />
  </label>
);

export default ToggleRow;
