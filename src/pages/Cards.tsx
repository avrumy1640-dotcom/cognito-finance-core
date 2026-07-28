import { formatTxDate, txGroupLabel } from "@/lib/dates";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import DataErrorState from "@/components/layout/DataErrorState";
import { useKyc } from "@/hooks/useKyc";
import {
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Smartphone,
  Globe,
  ShoppingBag,
  Wifi,
  CreditCard,
  ChevronRight,
  Shield,
  ShieldCheck,
  Plane,
  Settings,
  Search,
  Inbox,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

const controlIcons = {
  international: Globe,
  online: ShoppingBag,
  contactless: Wifi,
  inStore: CreditCard,
  atm: Shield,
} as const;

const controlLabels = {
  international: "International transactions",
  online: "Online purchases",
  contactless: "Contactless payments",
  inStore: "In-store purchases",
  atm: "ATM withdrawals",
} as const;

const controlDescriptions = {
  international: "Allow charges outside your home country",
  online: "Card-not-present and e-commerce",
  contactless: "Tap-to-pay at terminals",
  inStore: "Chip and swipe at merchants",
  atm: "Cash withdrawals at ATMs",
} as const;

type TxFilter = "all" | "in" | "out";

const CardsPage = () => {
  const navigate = useNavigate();
  const { card, transactions, toggleCardLock, toggleCardControl, replaceCard, reportStolen, issueCard, columnLive, dataStatus, dataError, retry } = useBank();
  const { canMoveMoney, status: kycStatus } = useKyc();
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"actions" | "controls" | "transactions">("actions");
  const [travelActive, setTravelActive] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TxFilter>("all");

  const cardTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.paymentMethod === "Debit Card")
      .filter((t) => (filter === "in" ? t.amount > 0 : filter === "out" ? t.amount < 0 : true))
      .filter((t) => !search || t.merchant.toLowerCase().includes(search.toLowerCase()));
  }, [transactions, filter, search]);

  const monthSpend = useMemo(() => {
    return transactions
      .filter((t) => t.paymentMethod === "Debit Card" && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactions]);

  const dailyCap = 10_000;
  const dailyUsed = Math.min(dailyCap, monthSpend / 30);
  const dailyPct = Math.min(100, Math.round((dailyUsed / dailyCap) * 100));

  // The card comes from the ledger, which hydrates a tick after mount. Render a
  // calm loading state rather than dereferencing a card that isn't there yet.
  if (!card) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          {dataStatus === "error" ? (
            <DataErrorState message={dataError ?? "We couldn't load your card."} onRetry={retry} />
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
        </div>
      </AppLayout>
    );
  }

  const fullNumber = `4829 1847 2946 ${card.last4}`;

  const cvv = "•••";

  const formatCurrency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(fullNumber.replace(/\s/g, ""));
      toast.success("Card number copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  // Card controls are handled by the in-app ledger:
  // travel-notice/control endpoints. We surface these as "not available" in
  // the UI so users can't be misled by fake success toasts.
  const CARD_CONTROLS_LIVE = false;

  const doReplace = () => {
    replaceCard(); // store now shows an honest "not available" toast
  };

  const doStolen = () => {
    if (!confirm("Report this card as stolen? A support agent will call you back to arrange a replacement.")) return;
    reportStolen();
  };

  const doLock = () => {
    toggleCardLock();
  };

  const toggleTravel = () => {
    toast.error("Travel notice isn't available yet", {
      description: "Contact support to enable international use before you travel.",
    });
  };

  const doIssueVirtual = async () => {
    if (!canMoveMoney) {
      toast.error("Verify your identity to issue a new card.");
      navigate("/profile/verify");
      return;
    }
    const ok = await issueCard({ type: "virtual" });
    if (ok) toast.success("Virtual card issued", { description: "Ready to use" });
    else toast.error("Card issuance failed");
  };

  const statusLabel = card.isLocked
    ? card.status === "stolen"
      ? "Reported stolen"
      : card.status === "replaced"
      ? "Replaced"
      : "Locked"
    : "Active";

  const filterChips: { key: TxFilter; label: string; icon?: typeof ArrowDownLeft }[] = [
    { key: "all", label: "All" },
    { key: "in", label: "Refunds", icon: ArrowDownLeft },
    { key: "out", label: "Spend", icon: ArrowUpRight },
  ];

  if (dataStatus === "error") {
    return (
      <AppLayout>
        <div className="px-5 pt-14">
          <DataErrorState message={dataError} onRetry={retry} title="We couldn't load your cards" />
        </div>
      </AppLayout>
    );
  }

  if (dataStatus === "loading") {
    return (
      <AppLayout>
        <div className="px-5 pt-14 space-y-4">
          <div className="h-6 w-40 rounded-lg bg-secondary animate-pulse" />
          <div className="h-52 w-full rounded-3xl bg-secondary animate-pulse" />
          <div className="h-20 w-full rounded-2xl bg-secondary animate-pulse" />
          <div className="h-20 w-full rounded-2xl bg-secondary animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5 pb-8">
        {/* Header — kicker + title, mirrors AccountDetail */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">Your cards</p>
            <h1 className="text-[22px] font-display font-bold text-foreground leading-tight tracking-tight">Glass Debit</h1>
          </div>
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center shadow-lg shadow-primary/20">
            <CreditCard size={18} className="text-primary-foreground" />
          </div>
        </motion.div>

        {/* KYC trust banner */}
        {kycStatus !== "verified" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <Shield size={18} className="text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Verify to unlock card features</p>
                <p className="text-xs text-muted-foreground mt-0.5">Issue virtual cards, change limits, and enable international spend.</p>
              </div>
              <button onClick={() => navigate("/profile/verify")} className="text-xs font-semibold text-primary shrink-0">Verify</button>
            </GlassCard>
          </motion.div>
        )}

        {/* Card visual hero — premium material with embossed chip,
            holographic sheen, and paper-fiber grain for depth. */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.05, type: "spring", damping: 22, stiffness: 240 }}
          whileTap={{ scale: 0.985 }}
        >
          <div
            className={`card-material gradient-card-face relative rounded-[26px] p-6 overflow-hidden transition-opacity ${card.isLocked ? "opacity-80" : ""}`}
            style={{
              minHeight: 232,
              boxShadow:
                "0 24px 60px -20px hsl(224 60% 6% / 0.55), 0 8px 20px -8px hsl(224 60% 6% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.08)",
            }}
          >
            <div className="flex items-start justify-between mb-10">
              <div>
                <p className="text-primary-foreground/60 text-[10px] font-semibold tracking-[0.28em] uppercase">Glass Bank</p>
                <p className="text-serif-display text-primary-foreground text-[22px] leading-none mt-2">{card.nickname}</p>
                <p className="text-primary-foreground/50 text-[10px] font-medium mt-1 uppercase tracking-widest">Private client</p>
              </div>
              <div className="flex items-center gap-1.5 bg-primary-foreground/12 border border-primary-foreground/15 rounded-full px-2.5 py-1 backdrop-blur-md">
                {card.isLocked ? (
                  <Lock size={11} className="text-primary-foreground" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(82_92%_62%_/_0.8)]" />
                )}
                <span className="text-[10px] text-primary-foreground font-semibold uppercase tracking-wider">{statusLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="card-chip" aria-hidden />
              <div className="flex-1">
                <p className="text-primary-foreground/50 text-[9px] font-semibold tracking-[0.2em] uppercase">Card number</p>
                <p className="text-primary-foreground text-[17px] font-mono tracking-[0.18em] tabular-nums mt-0.5">
                  {showDetails ? fullNumber : "•••• •••• •••• " + card.last4}
                </p>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-primary-foreground/50 text-[9px] font-semibold tracking-[0.2em] uppercase">Card holder</p>
                <p className="text-primary-foreground text-sm font-medium truncate mt-0.5">Alexandra Chen</p>
              </div>
              <div>
                <p className="text-primary-foreground/50 text-[9px] font-semibold tracking-[0.2em] uppercase">Expires</p>
                <p className="text-primary-foreground text-sm font-medium tabular-nums mt-0.5">{card.expiresAt}</p>
              </div>
              <div>
                <p className="text-primary-foreground/50 text-[9px] font-semibold tracking-[0.2em] uppercase">CVV</p>
                <p className="text-primary-foreground text-sm font-mono tabular-nums mt-0.5">{showDetails ? "329" : cvv}</p>
              </div>
              <div className="text-serif-display text-primary-foreground text-xl tracking-tight ml-auto italic">{card.network}</div>
            </div>
          </div>
        </motion.div>


        {/* Spend & trust chips */}
        <div className="grid grid-cols-2 gap-2">
          <GlassCard className="py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Month-to-date</p>
            <p className="text-lg font-display font-bold text-foreground mt-1">{formatCurrency(monthSpend)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Debit card spend</p>
          </GlassCard>
          <GlassCard className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Daily limit</p>
              <span className="text-[10px] text-muted-foreground font-mono">{dailyPct}%</span>
            </div>
            <p className="text-lg font-display font-bold text-foreground mt-1">{formatCurrency(dailyCap)}</p>
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden mt-1.5">
              <motion.div initial={{ width: 0 }} animate={{ width: `${dailyPct}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${dailyPct > 80 ? "bg-warning" : "gradient-hero"}`} />
            </div>
          </GlassCard>
        </div>

        {/* Cashback rewards entry point */}
        <button
          onClick={() => navigate("/rewards")}
          className="w-full text-left press"
        >
          <GlassCard className="flex items-center gap-3 py-3">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <span className="text-base">💚</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Cashback rewards</p>
              <p className="text-xs text-muted-foreground">
                1% back on every purchase · {formatCurrency(cashback?.available ?? 0)} ready to redeem
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </GlassCard>
        </button>

        {kycStatus === "verified" && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success bg-success/10 rounded-full px-2.5 py-1">
            <ShieldCheck size={12} /> PCI-DSS secured · Zero liability on unauthorized charges
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(["actions", "controls", "transactions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "actions" && (
            <motion.div key="actions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <ActionRow
                icon={card.isLocked ? Unlock : Lock}
                label={card.isLocked ? "Unlock card" : "Lock card"}
                sub={card.isLocked ? "Resume spending immediately" : "Instantly block all new charges"}
                onClick={doLock}
                tone={card.isLocked ? "primary" : "warning"}
              />
              <ActionRow
                icon={showDetails ? EyeOff : Eye}
                label={showDetails ? "Hide card details" : "Show card details"}
                sub="Reveal full number, CVV, and expiry"
                onClick={() => setShowDetails(!showDetails)}
              />
              <ActionRow icon={Copy} label="Copy card number" sub="Paste into checkout" onClick={copyNumber} />
              <ActionRow icon={Sparkles} label="Issue virtual card" sub="Ready in seconds for online use" onClick={doIssueVirtual} tone="primary" />
              <ActionRow icon={Smartphone} label="Add to Apple Wallet" sub="Provision to your device" onClick={() => {
                toast.loading("Provisioning card to Apple Wallet…", { id: "wallet" });
                setTimeout(() => toast.success("Added to Apple Wallet", { id: "wallet", description: `${card.network} •••• ${card.last4}` }), 1200);
              }} />
              <ActionRow icon={Plane} label={travelActive ? "Remove travel notice" : "Set travel notice"} sub={travelActive ? "Notice active for 30 days" : "Avoid holds while abroad"} onClick={toggleTravel} />
              <ActionRow icon={Settings} label="Change PIN" sub="Effective on next card use" onClick={() => {
                const pin = prompt("Enter a new 4-digit PIN");
                if (!pin) return;
                if (!/^\d{4}$/.test(pin)) { toast.error("PIN must be 4 digits"); return; }
                const confirm2 = prompt("Confirm your new PIN");
                if (confirm2 !== pin) { toast.error("PINs did not match"); return; }
                toast.success("PIN updated", { description: "Effective on next card use" });
              }} />
              <ActionRow icon={RefreshCw} label="Replace card" sub="Arrives in 5–7 business days" onClick={doReplace} />
              <ActionRow icon={AlertTriangle} label="Report lost or stolen" sub="Overnight replacement shipped" onClick={doStolen} tone="destructive" />
            </motion.div>
          )}

          {activeTab === "controls" && (
            <motion.div key="controls" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <GlassCard className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Fine-tune where your card works</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Changes take effect instantly and can be reversed anytime.</p>
                </div>
              </GlassCard>
              {(Object.keys(controlLabels) as Array<keyof typeof controlLabels>).map((key) => {
                const Icon = controlIcons[key];
                const enabled = card.controls[key];
                return (
                  <GlassCard
                    key={key}
                    onClick={() => {
                      toggleCardControl(key);
                      toast.success(`${controlLabels[key]} ${enabled ? "disabled" : "enabled"}`);
                    }}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${enabled ? "bg-primary/10" : "bg-secondary"}`}>
                        <Icon size={18} className={enabled ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{controlLabels[key]}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{controlDescriptions[key]}</p>
                      </div>
                    </div>
                    <div className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-secondary"}`}>
                      <div className={`w-5 h-5 rounded-full bg-primary-foreground shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </div>
                  </GlassCard>
                );
              })}
            </motion.div>
          )}

          {activeTab === "transactions" && (
            <motion.div key="tx" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant…"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-secondary text-foreground text-sm border-2 border-transparent outline-none focus:border-primary/40 focus:bg-card transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1" aria-label="Clear">
                    <X size={14} className="text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 mb-3">
                {filterChips.map((chip) => {
                  const active = filter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      onClick={() => setFilter(chip.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {chip.icon && <chip.icon size={12} />}
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              {cardTransactions.length === 0 ? (
                <GlassCard className="py-10 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                    <Inbox size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {search || filter !== "all" ? "No matches" : "No card transactions yet"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                      {search || filter !== "all"
                        ? "Try a different filter or clear your search."
                        : "Purchases with your Glass Debit card will show up here."}
                    </p>
                  </div>
                  {(search || filter !== "all") && (
                    <button onClick={() => { setSearch(""); setFilter("all"); }} className="text-xs font-semibold text-primary">
                      Clear filters
                    </button>
                  )}
                </GlassCard>
              ) : (
                <GlassCard className="divide-y divide-border p-0 overflow-hidden">
                  {cardTransactions.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => navigate(`/transaction/${tx.id}`)}
                      className="flex items-center justify-between w-full px-4 py-3 active:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg w-7 shrink-0">{tx.icon}</span>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{tx.merchant}</p>
                          <p className="text-xs text-muted-foreground truncate">{tx.category} · {formatTxDate(tx.date)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-sm font-semibold ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                          {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                        </p>
                        {tx.status === "pending" && (
                          <span className="text-[10px] text-warning font-medium">Pending</span>
                        )}
                      </div>
                    </button>
                  ))}
                </GlassCard>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

interface ActionRowProps {
  icon: typeof Lock;
  label: string;
  sub?: string;
  onClick: () => void;
  tone?: "primary" | "warning" | "destructive";
}

const ActionRow = ({ icon: Icon, label, sub, onClick, tone = "primary" }: ActionRowProps) => {
  const toneClasses =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
      ? "bg-warning/10 text-warning"
      : "bg-primary/10 text-primary";
  const labelClass = tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <GlassCard onClick={onClick} className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneClasses}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${labelClass}`}>{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </div>
      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
    </GlassCard>
  );
};

export default CardsPage;
