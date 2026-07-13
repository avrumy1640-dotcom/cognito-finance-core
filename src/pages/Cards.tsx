import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
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
  Plane,
  Settings,
} from "lucide-react";

const controlIcons = {
  international: Globe,
  online: ShoppingBag,
  contactless: Wifi,
  inStore: CreditCard,
  atm: Shield,
} as const;

const controlLabels = {
  international: "International Transactions",
  online: "Online Purchases",
  contactless: "Contactless Payments",
  inStore: "In-Store Purchases",
  atm: "ATM Withdrawals",
} as const;

const CardsPage = () => {
  const { card, transactions, toggleCardLock, toggleCardControl, replaceCard, reportStolen, issueCard, columnLive } = useBank();
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"actions" | "controls" | "transactions">("actions");
  const [travelActive, setTravelActive] = useState(false);

  const cardTransactions = transactions.filter((t) => t.paymentMethod === "Debit Card");
  const fullNumber = `4829 1847 2946 ${card.last4}`;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(fullNumber.replace(/\s/g, ""));
      toast.success("Card number copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const doReplace = () => {
    if (confirm("Order a replacement card? Your current card will be locked.")) {
      replaceCard();
      toast.success("Replacement card ordered", { description: "Arrives in 5–7 business days" });
    }
  };

  const doStolen = () => {
    if (confirm("Report this card as stolen? A new card will be issued.")) {
      reportStolen();
      toast.error("Card reported stolen", { description: "New card will be shipped overnight" });
    }
  };

  const doLock = () => {
    toggleCardLock();
    toast[card.isLocked ? "success" : "warning"](card.isLocked ? "Card unlocked" : "Card locked");
  };

  const toggleTravel = () => {
    setTravelActive((v) => !v);
    toast.success(travelActive ? "Travel notice removed" : "Travel notice set", {
      description: travelActive ? undefined : "International transactions enabled for 30 days",
    });
  };

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your Glass Debit card</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div
            className={`relative rounded-3xl p-6 overflow-hidden transition-opacity ${card.isLocked ? "opacity-70" : ""}`}
            style={{ background: "var(--gradient-hero)", minHeight: 210 }}
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                background:
                  "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.35), transparent 50%), radial-gradient(circle at 20% 80%, rgba(0,230,140,0.25), transparent 55%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-primary-foreground/70 text-[10px] font-medium tracking-[0.2em]">GLASS BANK</p>
                  <p className="text-primary-foreground text-xs font-semibold mt-0.5">{card.nickname}</p>
                </div>
                {card.isLocked && (
                  <div className="flex items-center gap-1 bg-primary-foreground/20 rounded-full px-2 py-0.5 backdrop-blur-sm">
                    <Lock size={12} className="text-primary-foreground" />
                    <span className="text-xs text-primary-foreground font-medium">
                      {card.status === "stolen" ? "Stolen" : card.status === "replaced" ? "Replaced" : "Locked"}
                    </span>
                  </div>
                )}
              </div>
              <div className="mb-6">
                <p className="text-primary-foreground/60 text-xs font-medium mb-1">Card Number</p>
                <p className="text-primary-foreground text-lg font-mono tracking-[0.2em]">
                  {showDetails ? fullNumber : "•••• •••• •••• " + card.last4}
                </p>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-primary-foreground/60 text-xs font-medium">Card Holder</p>
                  <p className="text-primary-foreground text-sm font-medium">Alexandra Chen</p>
                </div>
                <div>
                  <p className="text-primary-foreground/60 text-xs font-medium">Expires</p>
                  <p className="text-primary-foreground text-sm font-medium">{card.expiresAt}</p>
                </div>
                <div className="text-primary-foreground font-bold text-lg tracking-tight">{card.network}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${card.isLocked ? "bg-warning" : "bg-success"}`} />
            <span className="text-sm text-muted-foreground">{card.isLocked ? `Card is ${card.status}` : "Card is active"}</span>
          </div>
          <span className="text-xs text-muted-foreground">{card.linkedAccount}</span>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(["actions", "controls", "transactions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "actions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <GlassCard onClick={doLock} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {card.isLocked ? <Unlock size={20} className="text-primary" /> : <Lock size={20} className="text-primary" />}
                <span className="text-sm font-medium text-foreground">{card.isLocked ? "Unlock Card" : "Lock Card"}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard onClick={() => setShowDetails(!showDetails)} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {showDetails ? <EyeOff size={20} className="text-primary" /> : <Eye size={20} className="text-primary" />}
                <span className="text-sm font-medium text-foreground">{showDetails ? "Hide Details" : "Show Card Details"}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard onClick={copyNumber} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Copy size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Copy Card Number</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard onClick={doReplace} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <RefreshCw size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Replace Card</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard onClick={doStolen} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-destructive" />
                <span className="text-sm font-medium text-destructive">Report Lost or Stolen</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard
              onClick={() => toast.info("Apple Wallet", { description: "Provisioning card to Apple Wallet…" })}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Add to Apple Wallet</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard onClick={toggleTravel} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Plane size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {travelActive ? "Remove Travel Notice" : "Set Travel Notice"}
                </span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard
              onClick={() => toast.info("Change PIN", { description: "You'll receive a secure link by SMS" })}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Change PIN</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
          </motion.div>
        )}

        {activeTab === "controls" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
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
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">{controlLabels[key]}</span>
                  </div>
                  <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${enabled ? "bg-primary" : "bg-secondary"}`}>
                    <div
                      className={`w-5 h-5 rounded-full bg-primary-foreground shadow-sm transition-transform ${
                        enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </GlassCard>
              );
            })}
          </motion.div>
        )}

        {activeTab === "transactions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GlassCard className="divide-y divide-border p-0 overflow-hidden">
              {cardTransactions.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No card transactions yet.</div>
              )}
              {cardTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8">{tx.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.merchant}</p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                    {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </GlassCard>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default CardsPage;
