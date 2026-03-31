import { useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { cardData, transactions } from "@/data/mockData";
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

const CardsPage = () => {
  const [isLocked, setIsLocked] = useState(cardData.isLocked);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"actions" | "controls" | "transactions">("actions");

  const cardTransactions = transactions.filter((t) => t.paymentMethod === "Debit Card");

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your Glass Debit card</p>
        </motion.div>

        {/* Card Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className={`relative rounded-3xl p-6 overflow-hidden ${isLocked ? "opacity-60" : ""}`}
            style={{
              background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(230 80% 45%))",
              minHeight: 200,
            }}
          >
            <div className="absolute inset-0 opacity-20" style={{
              background: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15), transparent 50%)"
            }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <span className="text-primary-foreground/80 text-sm font-medium tracking-wider">GLASS BANK</span>
                {isLocked && (
                  <div className="flex items-center gap-1 bg-primary-foreground/20 rounded-full px-2 py-0.5">
                    <Lock size={12} className="text-primary-foreground" />
                    <span className="text-xs text-primary-foreground font-medium">Locked</span>
                  </div>
                )}
              </div>
              <div className="mb-6">
                <p className="text-primary-foreground/60 text-xs font-medium mb-1">Card Number</p>
                <p className="text-primary-foreground text-lg font-mono tracking-[0.2em]">
                  {showDetails ? "4829 1847 2946 4821" : "•••• •••• •••• " + cardData.last4}
                </p>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-primary-foreground/60 text-xs font-medium">Card Holder</p>
                  <p className="text-primary-foreground text-sm font-medium">Alexandra Chen</p>
                </div>
                <div>
                  <p className="text-primary-foreground/60 text-xs font-medium">Expires</p>
                  <p className="text-primary-foreground text-sm font-medium">{cardData.expiresAt}</p>
                </div>
                <div className="text-primary-foreground font-bold text-lg tracking-tight">{cardData.network}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card Status */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLocked ? "bg-warning" : "bg-success"}`} />
            <span className="text-sm text-muted-foreground">{isLocked ? "Card is locked" : "Card is active"}</span>
          </div>
          <span className="text-xs text-muted-foreground">{cardData.linkedAccount}</span>
        </div>

        {/* Tab Switcher */}
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

        {/* Actions */}
        {activeTab === "actions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <GlassCard onClick={() => setIsLocked(!isLocked)} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {isLocked ? <Unlock size={20} className="text-foreground" /> : <Lock size={20} className="text-foreground" />}
                <span className="text-sm font-medium text-foreground">{isLocked ? "Unlock Card" : "Lock Card"}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            <GlassCard onClick={() => setShowDetails(!showDetails)} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {showDetails ? <EyeOff size={20} className="text-foreground" /> : <Eye size={20} className="text-foreground" />}
                <span className="text-sm font-medium text-foreground">{showDetails ? "Hide Details" : "Show Card Details"}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </GlassCard>
            {[
              { icon: Copy, label: "Copy Card Number" },
              { icon: RefreshCw, label: "Replace Card" },
              { icon: AlertTriangle, label: "Report Stolen" },
              { icon: Smartphone, label: "Add to Apple Wallet" },
              { icon: Plane, label: "Set Travel Notice" },
              { icon: Settings, label: "Change PIN" },
            ].map((item) => (
              <GlassCard key={item.label} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <item.icon size={20} className="text-foreground" />
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </GlassCard>
            ))}
          </motion.div>
        )}

        {/* Controls */}
        {activeTab === "controls" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {[
              { icon: Globe, label: "International Transactions", enabled: true },
              { icon: ShoppingBag, label: "Online Purchases", enabled: true },
              { icon: Wifi, label: "Contactless Payments", enabled: true },
              { icon: CreditCard, label: "In-Store Purchases", enabled: true },
              { icon: Shield, label: "ATM Withdrawals", enabled: true },
            ].map((control) => (
              <GlassCard key={control.label} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <control.icon size={20} className="text-foreground" />
                  <span className="text-sm font-medium text-foreground">{control.label}</span>
                </div>
                <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${control.enabled ? "bg-primary" : "bg-secondary"}`}>
                  <div className={`w-5 h-5 rounded-full bg-primary-foreground shadow-sm transition-transform ${control.enabled ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </GlassCard>
            ))}
          </motion.div>
        )}

        {/* Transactions */}
        {activeTab === "transactions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GlassCard className="divide-y divide-border p-0 overflow-hidden">
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
