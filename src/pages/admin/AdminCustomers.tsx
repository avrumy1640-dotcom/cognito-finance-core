import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, AdminPage, DataTable, StatusPill } from "./AdminShell";

type Row = {
  user_id: string;
  email: string | null;
  preferred_name: string | null;
  phone: string | null;
  citizenship: string | null;
  created_at: string;
  kyc_status?: string;
};

const AdminCustomers = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, preferred_name, phone, citizenship, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const { data: kyc } = await supabase
        .from("kyc_profiles")
        .select("user_id, status")
        .limit(1000);
      const kycMap = new Map((kyc ?? []).map((k) => [k.user_id, k.status]));
      setRows(
        (profiles ?? []).map((p) => ({ ...p, kyc_status: kycMap.get(p.user_id) ?? "unverified" }))
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      (r.email ?? "").toLowerCase().includes(t) ||
      (r.preferred_name ?? "").toLowerCase().includes(t) ||
      (r.phone ?? "").toLowerCase().includes(t)
    );
  }, [rows, q]);

  return (
    <AdminPage>
      <AdminHeader
        title="Customers"
        subtitle={loading ? "Loading customers…" : `${filtered.length} shown · ${rows.length} total`}
        actions={
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, name, phone"
              className="pl-8 pr-3 py-2 w-72 rounded-lg bg-secondary text-sm outline-none border border-transparent focus:border-primary"
            />
          </div>
        }
      />
      <DataTable
        rows={filtered}
        empty={loading ? "Loading…" : "No customers"}
        columns={[
          { key: "name", header: "Name", render: (r) => r.preferred_name ?? "—" },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "citizenship", header: "Citizenship", render: (r) => r.citizenship ?? "—" },
          { key: "kyc", header: "KYC", render: (r) => <StatusPill status={r.kyc_status ?? "unverified"} /> },
          {
            key: "created",
            header: "Joined",
            render: (r) => new Date(r.created_at).toLocaleDateString(),
          },
        ]}
      />
    </AdminPage>
  );
};

export default AdminCustomers;
