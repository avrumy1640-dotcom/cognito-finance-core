import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, AdminPage, StatCard } from "./AdminShell";

const AdminDashboard = () => {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const counts = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("kyc_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("kyc_profiles").select("id", { count: "exact", head: true }).eq("status", "verified"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabase.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "error"),
        supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setStats({
        customers: counts[0].count ?? 0,
        kycPending: counts[1].count ?? 0,
        kycVerified: counts[2].count ?? 0,
        openTickets: counts[3].count ?? 0,
        webhookErrors: counts[4].count ?? 0,
        paymentReqPending: counts[5].count ?? 0,
      });
    })();
  }, []);

  return (
    <AdminPage>
      <AdminHeader
        title="Overview"
        subtitle="Live snapshot of customer, compliance, and operational health."
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total customers" value={stats.customers ?? "—"} />
        <StatCard label="KYC pending" value={stats.kycPending ?? "—"} hint="Awaiting compliance review" />
        <StatCard label="KYC verified" value={stats.kycVerified ?? "—"} hint="Cleared for money movement" />
        <StatCard label="Open tickets" value={stats.openTickets ?? "—"} hint="Includes in-progress" />
        <StatCard label="Webhook errors" value={stats.webhookErrors ?? "—"} hint="Last 30 days" />
        <StatCard label="Pending payment requests" value={stats.paymentReqPending ?? "—"} />
      </div>
    </AdminPage>
  );
};

export default AdminDashboard;
