import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, AdminPage, DataTable } from "./AdminShell";

type Row = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
};

const AdminAuditLogs = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminPage>
      <AdminHeader title="Audit logs" subtitle="Every administrative action, immutable." />
      <DataTable
        rows={rows}
        empty={loading ? "Loading…" : "No audit events yet"}
        columns={[
          { key: "when", header: "When", render: (r) => new Date(r.created_at).toLocaleString() },
          { key: "actor", header: "Actor", render: (r) => r.actor_email ?? "system" },
          { key: "action", header: "Action", render: (r) => <code className="text-xs">{r.action}</code> },
          { key: "entity", header: "Entity", render: (r) => `${r.entity_type}${r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}` },
          {
            key: "meta",
            header: "Metadata",
            render: (r) => (
              <span className="text-xs text-muted-foreground">
                {r.metadata ? JSON.stringify(r.metadata).slice(0, 60) : "—"}
              </span>
            ),
          },
        ]}
      />
    </AdminPage>
  );
};

export default AdminAuditLogs;
