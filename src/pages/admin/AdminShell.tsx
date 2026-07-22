import { ReactNode } from "react";

export const AdminHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export const AdminPage = ({ children }: { children: ReactNode }) => (
  <div className="p-8 max-w-[1400px] mx-auto">{children}</div>
);

export const StatCard = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-3xl font-display font-bold text-foreground mt-2">{value}</p>
    {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
  </div>
);

export const DataTable = <T,>({
  rows, columns, empty = "No records",
}: {
  rows: T[];
  columns: { key: string; header: string; render: (row: T) => ReactNode; className?: string }[];
  empty?: string;
}) => (
  <div className="rounded-xl border border-border bg-card overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-foreground ${c.className ?? ""}`}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const StatusPill = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    verified: "bg-emerald-500/10 text-emerald-600",
    approved: "bg-emerald-500/10 text-emerald-600",
    active: "bg-emerald-500/10 text-emerald-600",
    resolved: "bg-emerald-500/10 text-emerald-600",
    pending: "bg-amber-500/10 text-amber-600",
    waiting_customer: "bg-amber-500/10 text-amber-600",
    in_progress: "bg-blue-500/10 text-blue-600",
    open: "bg-primary/10 text-primary",
    rejected: "bg-red-500/10 text-red-600",
    error: "bg-red-500/10 text-red-600",
    closed: "bg-secondary text-muted-foreground",
    unverified: "bg-secondary text-muted-foreground",
    locked: "bg-red-500/10 text-red-600",
  };
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status.replace("_", " ")}
    </span>
  );
};
