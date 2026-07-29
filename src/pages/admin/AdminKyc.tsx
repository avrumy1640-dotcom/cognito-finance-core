import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminHeader, AdminPage, DataTable, StatusPill } from "./AdminShell";

type Row = {
  id: string;
  user_id: string;
  legal_first_name: string;
  legal_last_name: string;
  country: string;
  status: string;
  submitted_at: string;
  rejection_reason: string | null;
};

const TABS: Row["status"][] = ["pending", "verified", "rejected"];

const AdminKyc = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Row["status"]>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kyc_profiles")
      .select("id, user_id, legal_first_name, legal_last_name, country, status, submitted_at, rejection_reason")
      .eq("status", tab as "pending" | "verified" | "rejected")
      .order("submitted_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const decide = async (row: Row, next: "verified" | "rejected") => {
    let reason: string | null = null;
    if (next === "rejected") {
      reason = window.prompt("Rejection reason (visible to customer)") || null;
      if (!reason) return;
    }
    const { error } = await supabase
      .from("kyc_profiles")
      .update({
        status: next,
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({
      actor_id: user?.id,
      actor_email: user?.email,
      action: `kyc.${next}`,
      entity_type: "kyc_profile",
      entity_id: row.id,
      metadata: { user_id: row.user_id, reason },
    });
    toast.success(`KYC ${next}`);
    load();
  };

  return (
    <AdminPage>
      <AdminHeader
        title="KYC Review"
        subtitle="Approve or reject customer identity submissions."
      />
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <DataTable
        rows={rows}
        empty={loading ? "Loading…" : `No ${tab} submissions`}
        columns={[
          { key: "name", header: "Name", render: (r) => `${r.legal_first_name} ${r.legal_last_name}` },
          { key: "country", header: "Country", render: (r) => r.country },
          { key: "submitted", header: "Submitted", render: (r) => new Date(r.submitted_at).toLocaleString() },
          { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) =>
              r.status === "pending" ? (
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => decide(r, "verified")}
                    className="text-xs px-2.5 py-1 rounded-md bg-emerald-500 text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(r, "rejected")}
                    className="text-xs px-2.5 py-1 rounded-md bg-red-500 text-white"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{r.rejection_reason ?? "—"}</span>
              ),
            className: "text-right",
          },
        ]}
      />
    </AdminPage>
  );
};

export default AdminKyc;
