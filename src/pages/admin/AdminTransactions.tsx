import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, AdminPage, DataTable, StatCard, StatusPill } from "./AdminShell";

type PaymentRow = {
  id: string;
  requester_id: string;
  payer_email: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
};

const AdminTransactions = () => {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_requests")
        .select("id, requester_id, payer_email, amount_cents, currency, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as PaymentRow[]);
      setLoading(false);
    })();
  }, []);

  const money = (c: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(c / 100);

  return (
    <AdminPage>
      <AdminHeader
        title="Transactions"
        subtitle="Live and pending money movement across the platform."
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Payment requests" value={rows.length} />
        <StatCard label="Pending" value={rows.filter((r) => r.status === "pending").length} />
        <StatCard label="Paid" value={rows.filter((r) => r.status === "paid").length} />
      </div>
      <DataTable
        rows={rows}
        empty={loading ? "Loading…" : "No transactions"}
        columns={[
          { key: "id", header: "ID", render: (r) => <code className="text-xs">{r.id.slice(0, 8)}</code> },
          { key: "amount", header: "Amount", render: (r) => money(r.amount_cents, r.currency) },
          { key: "payer", header: "Payer", render: (r) => r.payer_email ?? "—" },
          { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
          { key: "created", header: "Created", render: (r) => new Date(r.created_at).toLocaleString() },
        ]}
      />
      <p className="text-xs text-muted-foreground mt-4">
        Real-time card and wire settlement events sync from the Iberbanco webhook (see Webhook logs).
      </p>
    </AdminPage>
  );
};

export default AdminTransactions;
