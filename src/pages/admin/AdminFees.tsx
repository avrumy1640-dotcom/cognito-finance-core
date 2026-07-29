import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminHeader, AdminPage, DataTable } from "./AdminShell";

type Fee = {
  id: string;
  key: string;
  label: string;
  amount_cents: number;
  percent_bps: number;
  currency: string;
  active: boolean;
};

const AdminFees = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("fee_config").select("*").order("key").limit(200);
    setRows((data ?? []) as Fee[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = async (fee: Fee, patch: Partial<Fee>) => {
    const { error } = await supabase
      .from("fee_config")
      .update({ ...patch, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("id", fee.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({
      actor_id: user?.id,
      actor_email: user?.email,
      action: "fee.update",
      entity_type: "fee_config",
      entity_id: fee.id,
      metadata: patch,
    });
    toast.success("Fee updated");
    load();
  };

  return (
    <AdminPage>
      <AdminHeader title="Fees" subtitle="Configure customer-facing pricing across products." />
      <DataTable
        rows={rows}
        empty={loading ? "Loading…" : "No fees configured"}
        columns={[
          { key: "label", header: "Fee", render: (r) => <span className="font-medium">{r.label}</span> },
          { key: "key", header: "Key", render: (r) => <code className="text-xs">{r.key}</code> },
          {
            key: "amount",
            header: "Flat (¢)",
            render: (r) => (
              <input
                type="number"
                defaultValue={r.amount_cents}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v !== r.amount_cents) update(r, { amount_cents: v });
                }}
                className="w-24 px-2 py-1 rounded-md bg-secondary text-sm outline-none"
              />
            ),
          },
          {
            key: "percent",
            header: "Percent (bps)",
            render: (r) => (
              <input
                type="number"
                defaultValue={r.percent_bps}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v !== r.percent_bps) update(r, { percent_bps: v });
                }}
                className="w-24 px-2 py-1 rounded-md bg-secondary text-sm outline-none"
              />
            ),
          },
          { key: "cur", header: "Currency", render: (r) => r.currency },
          {
            key: "active",
            header: "Active",
            render: (r) => (
              <button
                onClick={() => update(r, { active: !r.active })}
                className={`text-xs px-2.5 py-1 rounded-md ${
                  r.active ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground"
                }`}
              >
                {r.active ? "Active" : "Disabled"}
              </button>
            ),
          },
        ]}
      />
      <p className="text-xs text-muted-foreground mt-4">
        100 bps = 1%. Changes are audited and applied on the next fee calculation.
      </p>
    </AdminPage>
  );
};

export default AdminFees;
