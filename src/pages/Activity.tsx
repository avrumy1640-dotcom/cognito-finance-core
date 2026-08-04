import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import EmptyState from "@/components/glass/EmptyState";
import { Receipt } from "lucide-react";
import { useBank } from "@/store/bankStore";
import DataErrorState from "@/components/layout/DataErrorState";
import { Download, ChevronRight, FileText } from "lucide-react";
import { buildCsv, buildPdf, type ExportResult } from "@/lib/exports";
import ExportPreviewModal from "@/components/exports/ExportPreviewModal";
import { formatTxDate, txGroupLabel } from "@/lib/dates";
import { transferStatusInfo, toneClass } from "@/lib/transferStatus";
import {
  FilterShell,
  FilterChip,
  DateRangeField,
  AmountRangeField,
  SelectField,
  inDateWindow,
  inAmountWindow,
} from "@/components/filters/FilterBar";

const filterChips = ["All", "Card", "Transfers", "Deposits", "Bills", "P2P", "Pending", "Income", "Fees"];

const RAIL_OPTIONS = [
  { value: "all", label: "Any rail" },
  { value: "ach", label: "ACH" },
  { value: "wire", label: "Wire" },
  { value: "book", label: "Internal (book)" },
  { value: "card", label: "Card" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "posted", label: "Posted" },
  { value: "pending", label: "Pending" },
  { value: "returned", label: "Returned / failed" },
];

const DIRECTION_OPTIONS = [
  { value: "all", label: "Money in and out" },
  { value: "in", label: "Money in only" },
  { value: "out", label: "Money out only" },
];

/**
 * Rail detection reads whatever the ledger row exposes — different sources
 * populate paymentMethod, category or the provider status string.
 */
function matchesRail(tx: { paymentMethod?: string | null; category?: string | null; providerStatus?: string | null; merchant?: string | null }, rail: string) {
  if (rail === "all") return true;
  const haystack = `${tx.paymentMethod ?? ""} ${tx.category ?? ""} ${tx.providerStatus ?? ""} ${tx.merchant ?? ""}`.toLowerCase();
  if (rail === "card") return haystack.includes("card");
  if (rail === "ach") return haystack.includes("ach");
  if (rail === "wire") return haystack.includes("wire");
  if (rail === "book") return haystack.includes("book") || haystack.includes("internal");
  return true;
}

const PAGE_SIZE = 50;

const ActivityPage = () => {
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [rail, setRail] = useState("all");
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const navigate = useNavigate();
  const { transactions, dataStatus, dataError, retry, hasMoreTransactions, loadingMoreTransactions, loadMoreTransactions } = useBank();

  const advancedCount =
    (dateFrom || dateTo ? 1 : 0) +
    (minAmount || maxAmount ? 1 : 0) +
    (rail !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (direction !== "all" ? 1 : 0);

  const clearAll = () => {
    setSearchQuery("");
    setActiveFilter("All");
    setDateFrom("");
    setDateTo("");
    setMinAmount("");
    setMaxAmount("");
    setRail("all");
    setStatus("all");
    setDirection("all");
  };

  // Filtering is memoised so a 10k-row ledger doesn't re-scan on every render.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      // Text search spans merchant, category and account so a bookkeeper can
      // find a row by whatever they remember about it.
      if (
        q &&
        !`${tx.merchant ?? ""} ${tx.category ?? ""} ${tx.account ?? ""}`.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (!inDateWindow(tx.date, dateFrom, dateTo)) return false;
      if (!inAmountWindow(tx.amount, minAmount, maxAmount)) return false;
      if (!matchesRail(tx, rail)) return false;

      if (direction === "in" && tx.amount <= 0) return false;
      if (direction === "out" && tx.amount >= 0) return false;

      if (status !== "all") {
        const info = transferStatusInfo(tx.providerStatus, tx.status);
        if (status === "posted" && !(tx.status === "posted" && info.tone !== "danger")) return false;
        if (status === "pending" && tx.status !== "pending") return false;
        if (status === "returned" && info.tone !== "danger") return false;
      }

      if (activeFilter === "Pending") return tx.status === "pending";
      if (activeFilter === "Income") return tx.type === "credit";
      if (activeFilter === "Card") return tx.paymentMethod === "Debit Card";
      if (activeFilter === "Transfers") return tx.category === "Transfer";
      if (activeFilter === "Deposits") return tx.category === "Income";
      if (activeFilter === "Bills") return tx.category === "Bills";
      if (activeFilter === "P2P") return tx.category === "P2P";
      if (activeFilter === "Fees") return tx.category === "Fees";
      return true;
    });
  }, [transactions, searchQuery, activeFilter, dateFrom, dateTo, minAmount, maxAmount, rail, status, direction]);

  // Reset the window whenever the result set changes.
  useEffect(() => { setVisible(PAGE_SIZE); }, [searchQuery, activeFilter, dateFrom, dateTo, minAmount, maxAmount, rail, status, direction]);


  const page = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  // Group only the rows we actually render.
  const groups = useMemo(() => {
    const g: Record<string, typeof transactions> = {};
    page.forEach((tx) => {
      const key = txGroupLabel(tx.date);
      if (!g[key]) g[key] = [];
      g[key].push(tx);
    });
    return g;
  }, [page]);

  const rowsFor = () =>
    filtered.map((tx) => ({
      Date: formatTxDate(tx.date),
      Merchant: tx.merchant,
      Category: tx.category,
      Account: tx.account,
      Amount: tx.amount.toFixed(2),
      Status: transferStatusInfo(tx.providerStatus, tx.status).label,
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

  if (dataStatus === "error") {
    return (
      <AppLayout>
        <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12">
          <DataErrorState message={dataError} onRetry={retry} title="We couldn't load your activity" />
        </div>
      </AppLayout>
    );
  }

  if (dataStatus === "loading") {
    return (
      <AppLayout>
        <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-3">
          <div className="h-6 w-32 rounded-lg bg-secondary animate-pulse" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 w-full rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Activity</h1>
              <p className="text-sm text-muted-foreground mt-1">All transactions & history</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
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

        {/* Search + quick chips + precise filters */}
        <FilterShell
          search={searchQuery}
          onSearch={setSearchQuery}
          placeholder="Search merchant, category or account…"
          activeCount={advancedCount}
          onClear={clearAll}
          chips={filterChips.map((chip) => (
            <FilterChip
              key={chip}
              label={chip}
              active={activeFilter === chip}
              onClick={() => setActiveFilter(chip)}
            />
          ))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <DateRangeField from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
            <AmountRangeField min={minAmount} max={maxAmount} onMin={setMinAmount} onMax={setMaxAmount} />
            <SelectField label="Rail" value={rail} onChange={setRail} options={RAIL_OPTIONS} />
            <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <SelectField label="Direction" value={direction} onChange={setDirection} options={DIRECTION_OPTIONS} />
          </div>
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> of{" "}
            {transactions.length} loaded transactions.
          </p>
        </FilterShell>


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
          {filtered.length === 0 && transactions.length === 0 && (
            <EmptyState
              icon={Receipt}
              title="No activity yet"
              description="Once money moves in or out, every transaction lands here with its category, status and receipt."
              actions={[
                { label: "Add money", onClick: () => navigate("/move-money/add") },
                { label: "Set up direct deposit", onClick: () => navigate("/direct-deposit"), variant: "ghost" },
              ]}
            />
          )}
          {filtered.length === 0 && transactions.length > 0 && (
            <EmptyState
              emoji="🔍"
              title="No transactions match"
              description="Try a different search term, or clear the filters to see everything again."
              actions={[
                { label: "Clear filters", onClick: () => { setSearchQuery(""); setActiveFilter("All"); }, variant: "ghost" },
                { label: "Move money", onClick: () => navigate("/move-money") },
              ]}
            />
          )}
          {(Object.entries(groups) as Array<[string, typeof transactions]>).map(([group, txs]) => (
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
                        {(() => {
                          // Show the partner's real state, not a flat "pending".
                          if (tx.status === "posted" && !tx.providerStatus) return null;
                          const info = transferStatusInfo(tx.providerStatus, tx.status);
                          if (info.tone === "success" && tx.status === "posted") return null;
                          return (
                            <span className={`text-[10px] font-medium ${toneClass[info.tone]}`}>
                              {info.label}
                            </span>
                          );
                        })()}
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </GlassCard>
            </div>
          ))}

          {filtered.length > page.length && (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="w-full h-11 rounded-xl border border-border text-sm font-medium text-foreground active:bg-secondary/50 transition-colors"
            >
              Load {Math.min(PAGE_SIZE, filtered.length - page.length)} more
              <span className="text-muted-foreground font-normal"> · {page.length} of {filtered.length}</span>
            </button>
          )}

          {/* Everything loaded locally, but the banking partner mirror still has
              older records — fetch the next server page. */}
          {filtered.length <= page.length && hasMoreTransactions && (
            <button
              onClick={() => void loadMoreTransactions()}
              disabled={loadingMoreTransactions}
              className="w-full h-11 rounded-xl border border-border text-sm font-medium text-foreground active:bg-secondary/50 transition-colors disabled:opacity-60"
            >
              {loadingMoreTransactions ? "Loading older activity…" : "Load older activity"}
            </button>
          )}
        </div>
      </div>
      <ExportPreviewModal result={exportResult} onClose={() => setExportResult(null)} />
    </AppLayout>
  );
};

export default ActivityPage;
