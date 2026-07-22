import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminHeader, AdminPage, DataTable } from "./AdminShell";
import type { AppRole } from "@/hooks/useRole";

type Row = {
  user_id: string;
  email: string | null;
  preferred_name: string | null;
  roles: AppRole[];
};

const ALL_ROLES: AppRole[] = ["admin", "compliance", "support", "user"];

const AdminRoles = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, email, preferred_name").limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const map = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      map.set(r.user_id, arr);
    });
    setRows(
      (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        email: p.email,
        preferred_name: p.preferred_name,
        roles: map.get(p.user_id) ?? [],
      }))
    );
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (row: Row, role: AppRole) => {
    const has = row.roles.includes(role);
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", row.user_id).eq("role", role);
    } else {
      await supabase.from("user_roles").insert({ user_id: row.user_id, role });
    }
    await supabase.from("audit_logs").insert({
      actor_id: user?.id,
      actor_email: user?.email,
      action: has ? "role.revoke" : "role.grant",
      entity_type: "user",
      entity_id: row.user_id,
      metadata: { role },
    });
    toast.success(has ? `Removed ${role}` : `Granted ${role}`);
    load();
  };

  return (
    <AdminPage>
      <AdminHeader title="User permissions" subtitle="Assign staff roles. Every change is audited." />
      <DataTable
        rows={rows}
        empty={loading ? "Loading…" : "No users"}
        columns={[
          { key: "name", header: "User", render: (r) => r.preferred_name ?? r.email ?? r.user_id.slice(0, 8) },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          {
            key: "roles",
            header: "Roles",
            render: (r) => (
              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.filter((x) => x !== "user").map((role) => {
                  const has = r.roles.includes(role);
                  return (
                    <button
                      key={role}
                      onClick={() => toggle(r, role)}
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${
                        has ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            ),
          },
        ]}
      />
    </AdminPage>
  );
};

export default AdminRoles;
