import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, AdminPage, DataTable, StatCard, StatusPill } from "./AdminShell";

type Customer = { user_id: string; email: string | null; preferred_name: string | null };

const AdminCards = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, email, preferred_name")
        .order("created_at", { ascending: false })
        .limit(200);
      setCustomers((data ?? []) as Customer[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminPage>
      <AdminHeader
        title="Cards"
        subtitle="Issued cards, controls, and lifecycle events."
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Customers" value={customers.length} />
        <StatCard label="Card program" value="Iberbanco" hint="Physical + virtual" />
        <StatCard label="Active issuance API" value="v2" />
      </div>
      <DataTable
        rows={customers}
        empty={loading ? "Loading…" : "No customers"}
        columns={[
          { key: "name", header: "Cardholder", render: (r) => r.preferred_name ?? r.email ?? r.user_id.slice(0, 8) },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "primary_card", header: "Primary card", render: () => "•••• 4392 · Debit" },
          { key: "status", header: "Status", render: () => <StatusPill status="active" /> },
          { key: "region", header: "Region", render: () => "US" },
        ]}
      />
      <p className="text-xs text-muted-foreground mt-4">
        Card lock / reissue / limit changes flow through the Iberbanco proxy edge function. Sensitive PAN and CVV data are never stored in this dashboard.
      </p>
    </AdminPage>
  );
};

export default AdminCards;
