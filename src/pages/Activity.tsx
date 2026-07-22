import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { Search, Download, ChevronRight, SlidersHorizontal, FileText } from "lucide-react";
import { buildCsv, buildPdf, type ExportResult } from "@/lib/exports";
import ExportPreviewModal from "@/components/exports/ExportPreviewModal";

const filterChips = ["All", "Card", "Transfers", "Deposits", "Bills", "P2P", "Pending", "Income", "Fees"];

const ActivityPage = () => {
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const navigate = useNavigate();
  const { transactions } = useBank();

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      !searchQuery ||
      tx.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === "All") return matchesSearch;
    if (activeFilter === "Pending") return matchesSearch && tx.status === "pending";
    if (activeFilter === "Income") return matchesSearch && tx.type === "credit";
    if (activeFilter === "Card") return matchesSearch && tx.paymentMethod === "Debit Card";
    if (activeFilter === "Transfers") return matchesSearch && tx.category === "Transfer";
    if (activeFilter === "Deposits") return matchesSearch && tx.category === "Income";
    if (activeFilter === "Bills") return matchesSearch && tx.category === "Bills";
    if (activeFilter === "P2P") return matchesSearch && tx.category === "P2P";
    return matchesSearch;
  });

  // Group transactions
  const groups: Record<string, typeof transactions> = {};
  filtered.forEach((tx) => {
    const key = tx.date.includes("Today")
      ? "Today"
      : tx.date.includes("Yesterday")
      ? "Yesterday"
      : tx.date.startsWith("Mar 2")
      ? "This Week"
      : "Earlier";
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });

  const rowsFor = () =>
    filtered.map((tx) => ({
      Date: tx.date,
      Merchant: tx.merchant,
      Category: tx.category,
      Account: tx.account,
      Amount: tx.amount.toFixed(2),
      Status: tx.status,
      Type: tx.type,
    }));

  const runExport = (format: "csv" | "pdf") => {
    const headers = ["Date", "Merchant", "Category", "Account", "Amount", "Status", "Type"];
    const rows = rowsFor();
    const scope = activeFilter === "All" ? "all" : activeFilter.toLowerCase();
    const result =
      format === "csv"
        ? buildCsv(`activity-${scope}`, headers, rows)
        : buildPdf(`activity-${scope}`, "Transaction report", `Filter: ${activeFilter} · ${rows.length} rows`, headers, rows);
    setExportResult(result);
    setShowExportMenu(false);
  };


  const insightShortcuts = [
    { label: "Subscriptions", emoji: "📱", filter: null as string | null },
    { label: "Top Merchants", emoji: "🏪", filter: null },
    { label: "Recurring", emoji: "🔄", filter: null },
    { label: "Refunds", emoji: "💸", filter: "Income" },
  ];

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Activity</h1>
              <p className="text-sm text-muted-foreground mt-1">All transactions & history</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
                title="Export report"
              >
                <Download size={18} className="text-muted-foreground" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-2xl shadow-lg overflow-hidden z-30">
                  <button onClick={() => runExport("csv")} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary">
                    <FileText size={14} className="text-primary" /> CSV report
                  </button>
                  <button onClick={() => runExport("pdf")} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary border-t border-border">
                    <FileText size={14} className="text-primary" /> PDF report
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => navigate("/insights")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            title="Spending insights"
          >
            <SlidersHorizontal size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {filterChips.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === chip
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Insights Shortcuts */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {insightShortcuts.map((item) => (
            <button
              key={item.label}
              onClick={() => (item.filter ? setActiveFilter(item.filter) : navigate("/insights"))}
              className="min-w-fit"
            >
              <GlassCard className="flex items-center gap-2 py-2 px-3">
                <span>{item.emoji}</span>
                <span className="text-xs font-medium text-foreground whitespace-nowrap">{item.label}</span>
              </GlassCard>
            </button>
          ))}
        </div>

        {/* Transaction Groups */}
        <div className="space-y-4 pb-4">
          {filtered.length === 0 && (
            <GlassCard className="text-center py-10">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-sm font-medium text-foreground">No transactions match</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Try clearing filters or start a new transaction.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => { setSearchQuery(""); setActiveFilter("All"); }}
                  className="px-3 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold"
                >
                  Clear filters
                </button>
                <button
                  onClick={() => navigate("/move-money")}
                  className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Move money
                </button>
              </div>
            </GlassCard>
          )}
          {Object.entries(groups).map(([group, txs]) => (
            <div key={group}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {group}
              </h3>
              <GlassCard className="divide-y divide-border p-0 overflow-hidden">
                {txs.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => navigate(`/transaction/${tx.id}`)}
                    className="flex items-center justify-between w-full px-4 py-3 active:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-8">{tx.icon}</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{tx.merchant}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category} · {tx.account}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                          {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                        </p>
                        {tx.status === "pending" && (
                          <span className="text-[10px] text-warning font-medium">Pending</span>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default ActivityPage;
