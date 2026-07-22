import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, AdminPage, DataTable, StatusPill } from "./AdminShell";

type Row = {
  id: string;
  provider: string;
  event_type: string;
  status: string;
  payload: unknown;
  error: string | null;
  received_at: string;
};

const AdminWebhooks = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("webhook_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminPage>
      <AdminHeader title="Webhook logs" subtitle="Incoming events from Iberbanco and other providers." />
      <DataTable
        rows={rows}
        empty={loading ? "Loading…" : "No webhook events yet"}
        columns={[
          { key: "provider", header: "Provider", render: (r) => r.provider },
          { key: "event", header: "Event", render: (r) => <code className="text-xs">{r.event_type}</code> },
          { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
          { key: "received", header: "Received", render: (r) => new Date(r.received_at).toLocaleString() },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="text-xs text-primary"
              >
                {expanded === r.id ? "Hide" : "View"}
              </button>
            ),
            className: "text-right",
          },
        ]}
      />
      {expanded && (
        <pre className="mt-4 p-4 rounded-lg bg-card border border-border text-xs overflow-auto max-h-96">
          {JSON.stringify(rows.find((r) => r.id === expanded), null, 2)}
        </pre>
      )}
    </AdminPage>
  );
};

export default AdminWebhooks;
