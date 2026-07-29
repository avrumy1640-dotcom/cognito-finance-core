import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Boxes } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRole";

const nav = [
  { to: "/admin/provider", label: "Provider sandbox", icon: Boxes },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useRoles();

  const badge = isAdmin ? "Admin" : "Staff";

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
