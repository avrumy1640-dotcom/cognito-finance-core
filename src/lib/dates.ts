// Transaction timestamps travel through the app as ISO strings (the ledger's
// canonical form). Display formatting lives here so every screen shows the
// same thing.

const time = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today, 2:14 PM" · "Yesterday, 9:03 AM" · "Jul 12, 4:20 PM" · "Dec 2, 2025" */
export function formatTxDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return `Today, ${time(d)}`;
  if (days === 1) return `Yesterday, ${time(d)}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time(d)}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Section header used by the activity ledger. */
export function txGroupLabel(iso: string): "Today" | "Yesterday" | "This Week" | "Earlier" {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This Week";
  return "Earlier";
}
