// Human labels for the banking partner's real transfer lifecycle.
//
// The app used to collapse everything into "pending" or "posted", which hid
// meaningful states (manual review, returned, dishonored). These labels are the
// honest version: whatever the partner says the transfer is actually doing.
export type TransferTone = "neutral" | "progress" | "success" | "warning" | "danger";

const MAP: Record<string, { label: string; tone: TransferTone; hint: string }> = {
  initiated: { label: "Initiated", tone: "progress", hint: "We've received the instruction and queued it with our banking partner." },
  scheduled: { label: "Scheduled", tone: "progress", hint: "Queued to be sent on its scheduled date." },
  manual_review: { label: "In review", tone: "warning", hint: "Our banking partner is reviewing this transfer before it's sent." },
  pending_submission: { label: "Awaiting submission", tone: "progress", hint: "Waiting for the next network window to be submitted." },
  pending: { label: "Pending", tone: "progress", hint: "Sent to the network and waiting to settle." },
  submitted: { label: "Submitted", tone: "progress", hint: "Submitted to the network. Funds stay on hold until it settles." },
  settled: { label: "Settled", tone: "success", hint: "Funds have settled with the receiving bank." },
  completed: { label: "Completed", tone: "success", hint: "This transfer is complete." },
  posted: { label: "Posted", tone: "success", hint: "This transaction has posted to your account." },
  returned: { label: "Returned", tone: "danger", hint: "The receiving bank returned this transfer. The money came back to your account." },
  dishonored: { label: "Dishonored", tone: "danger", hint: "The receiving bank refused the return correction. Contact support." },
  contested: { label: "Contested", tone: "warning", hint: "The return on this transfer is being contested." },
  rejected: { label: "Rejected", tone: "danger", hint: "Our banking partner rejected this transfer." },
  canceled: { label: "Canceled", tone: "neutral", hint: "This transfer was canceled before it was sent." },
  cancelled: { label: "Canceled", tone: "neutral", hint: "This transfer was canceled before it was sent." },
  failed: { label: "Failed", tone: "danger", hint: "This transfer could not be completed." },
};

export function transferStatusInfo(providerStatus?: string, fallback: "pending" | "posted" = "pending") {
  const key = String(providerStatus ?? fallback).toLowerCase();
  return MAP[key] ?? MAP[fallback];
}

/** Tailwind text colour for a status tone, using semantic tokens only. */
export const toneClass: Record<TransferTone, string> = {
  neutral: "text-muted-foreground",
  progress: "text-warning",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};
