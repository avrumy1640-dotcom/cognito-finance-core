import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShieldCheck, CreditCard, ArrowLeftRight, Coins,
  Repeat, Percent, Webhook, ScrollText, LifeBuoy, KeyRound, BarChart3, LogOut, Boxes,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRole";

const nav = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/kyc", label: "KYC Review", icon: ShieldCheck },
  { to: "/admin/accounts", label: "Accounts", icon: BarChart3 },
  { to: "/admin/cards", label: "Cards", icon: CreditCard },
  { to: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/admin/crypto", label: "Crypto", icon: Coins },
  { to: "/admin/exchange", label: "Exchange", icon: Repeat },
  { to: "/admin/fees", label: "Fees", icon: Percent },
  { to: "/admin/webhooks", label: "Webhook logs", icon: Webhook },
  { to: "/admin/audit", label: "Audit logs", icon: ScrollText },
  { to: "/admin/tickets", label: "Support tickets", icon: LifeBuoy },
  { to: "/admin/roles", label: "User permissions", icon: KeyRound },
  { to: "/admin/provider", label: "Provider sandbox", icon: Boxes },

];

const AdminLayout = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isCompliance, isSupport } = useRoles();

  const badge = isAdmin ? "Admin" : isCompliance ? "Compliance" : isSupport ? "Support" : "Staff";

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 border-r border-border bg-card flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Glass Bank</p>
          <p className="text-lg font-display font-bold text-foreground">Admin Console</p>
          <span className="mt-2 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {badge}
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => navigate("/")}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary"
          >
            ← Back to customer app
          </button>
          <div className="px-3 py-2 text-[11px] text-muted-foreground truncate">{user?.email}</div>
          <button
            onClick={async () => { await signOut(); navigate("/"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
