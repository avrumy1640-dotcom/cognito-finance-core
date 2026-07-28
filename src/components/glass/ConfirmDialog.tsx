import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * In-app confirmation for destructive/irreversible actions.
 * Replaces native window.confirm — themed, accessible, 56px tall actions
 * with wrapping text so long labels never clip.
 */
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-w-[calc(100vw-2.5rem)] sm:max-w-md rounded-3xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-base font-display leading-snug break-words text-left">
          {title}
        </AlertDialogTitle>
        {description && (
          <AlertDialogDescription className="text-sm leading-relaxed break-words text-left">
            {description}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
        <AlertDialogCancel className="mt-0 min-h-[52px] w-full sm:w-auto rounded-2xl text-sm font-semibold whitespace-normal leading-snug">
          {cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className={`min-h-[52px] w-full sm:w-auto rounded-2xl text-sm font-semibold whitespace-normal leading-snug ${
            destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""
          }`}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;
