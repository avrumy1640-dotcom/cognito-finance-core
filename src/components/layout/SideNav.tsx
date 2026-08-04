import {
  Home,
  ArrowLeftRight,
  CreditCard,
  Activity,
  User,
  Target,
  PieChart,
  Gift,
  TrendingUp,
  Users,
  Zap,
  ShieldAlert,
  FileText,
  CalendarClock,
  Settings as SettingsIcon,
  ShieldCheck,
  QrCode,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useBusiness } from "@/hooks/useBusiness";
import { Landmark, Send, Receipt as ReceiptIcon, BookOpen } from "lucide-react";

const groups: { label: string; items: { to: string; label: string; icon: typeof Home }[] }[] = [
  {
    label: "Banking",
    items: [
      { to: "/", label: "Overview", icon: Home },
      { to: "/move-money", label: "Move money", icon: ArrowLeftRight },
      { to: "/receive", label: "Receive", icon: QrCode },
      { to: "/cards", label: "Cards", icon: CreditCard },
      { to: "/activity", label: "Activity", icon: Activity },
      { to: "/scheduled", label: "Scheduled", icon: CalendarClock },
    ],
  },
  {
    label: "Grow",
    items: [
      { to: "/goals", label: "Goals", icon: Target },
      { to: "/insights", label: "Insights", icon: PieChart },
      { to: "/rewards", label: "Rewards", icon: Gift },
      { to: "/credit", label: "Credit", icon: TrendingUp },
      { to: "/referrals", label: "Referrals", icon: Users },
      { to: "/early-pay", label: "Early pay", icon: Zap },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile/documents", label: "Documents", icon: FileText },
      { to: "/disputes", label: "Disputes", icon: ShieldAlert },
      { to: "/security", label: "Security", icon: ShieldCheck },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
];

const businessGroups: typeof groups = [
  {
    label: "Business",
    items: [
      { to: "/business", label: "Overview", icon: Landmark },
      { to: "/payments", label: "Payments", icon: Send },
      { to: "/bills", label: "Bills to pay", icon: ReceiptIcon },
      { to: "/invoices", label: "Invoices", icon: FileText },
      { to: "/approvals", label: "Approvals", icon: ShieldCheck },
      { to: "/bookkeeping", label: "Bookkeeping", icon: BookOpen },
      { to: "/reimbursements", label: "Reimbursements", icon: ReceiptIcon },
      { to: "/team", label: "Team", icon: Users },
      { to: "/activity", label: "Activity", icon: Activity },
      { to: "/scheduled", label: "Scheduled", icon: CalendarClock },
      { to: "/cards", label: "Cards", icon: CreditCard },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile/documents", label: "Documents", icon: FileText },
      { to: "/disputes", label: "Disputes", icon: ShieldAlert },
      { to: "/security", label: "Security", icon: ShieldCheck },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
];

const SideNav = () => {
  const { isBusiness, businessName } = useBusiness();
  const nav = isBusiness ? businessGroups : groups;
  return (
  <aside
    className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl"
    aria-label="Primary"
  >
    <div className="px-6 py-6">
      <p className="kicker text-primary">Glass Bank</p>
      <p className="text-lg font-display font-bold text-foreground leading-tight truncate">
        {isBusiness ? businessName : "Your money"}
      </p>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-5 hide-scrollbar">
      {nav.map((group) => (
        <div key={group.label}>
          <p className="text-section-title px-3 mb-1.5">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 min-h-11 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )
                  }
                >
                  <item.icon size={18} strokeWidth={1.9} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  </aside>
  );
};

export default SideNav;
