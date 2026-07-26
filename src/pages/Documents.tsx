import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { ArrowLeft, FileText, Download, Search, Receipt, Shield, Bell } from "lucide-react";
import { useBank } from "@/store/bankStore";
import { generateMonthlyStatement, generate1099INT } from "@/lib/pdfDocuments";
import type { Transaction } from "@/types/transaction";

const categories = ["All", "Statements", "Tax Forms", "Notices", "Agreements"] as const;
type Category = (typeof categories)[number];

type DocRow = {
  id: string;
  name: string;
  category: Category;
  date: string;
  account: string;
  read: boolean;
  icon: typeof FileText;
  download: () => void;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const parseTxDate = (raw: string): Date | null => {
  // Data uses formats like "Today, 3:12 PM", "Mar 12, 2026", "2026-03-12", etc.
  if (!raw) return null;
  if (/^today/i.test(raw)) return new Date();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const Documents = () => {
  const navigate = useNavigate();
  const { accounts, transactions } = useBank();
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const rows = useMemo<DocRow[]>(() => {
    const list: DocRow[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();

    // --- Monthly statements: last 12 completed months per account -------
    const acctList = [
      { key: "Checking", acc: accounts.checking },
      { key: "Savings", acc: accounts.savings },
    ];

    for (const { key, acc } of acctList) {
      for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i - 1, 1);
        const periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

        list.push({
          id: `stmt-${key}-${d.getFullYear()}-${d.getMonth()}`,
          name: `${label} Statement`,
          category: "Statements",
          date: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} 1, ${d.getFullYear()}`,
          account: key,
          read: i > 0,
          icon: FileText,
          download: () => {
            const txs = (transactions as Transaction[]).filter((t) => {
              if (t.account !== key) return false;
              const dt = parseTxDate(t.date);
              if (!dt) return i === 0; // "Today" entries go into current statement
              return dt >= periodStart && dt <= periodEnd;
            });
            generateMonthlyStatement({
              account: acc,
              transactions: txs,
              periodLabel: label,
              periodStart,
              periodEnd,
            });
            toast.success(`${label} statement downloaded`);
          },
        });
      }
    }

    // --- Year-end 1099-INT tax documents (past 3 tax years) --------------
    for (let y = 1; y <= 3; y++) {
      const taxYear = currentYear - y;
      const savings = accounts.savings;
      const interest = Number(
        (savings.interestEarned ?? Math.max(0, savings.availableBalance * (savings.apy ?? 0) / 100)).toFixed(2)
      );
      list.push({
        id: `1099int-savings-${taxYear}`,
        name: `1099-INT Tax Form (${taxYear})`,
        category: "Tax Forms",
        date: `Jan 31, ${taxYear + 1}`,
        account: "Savings",
        read: true,
        icon: Receipt,
        download: () => {
          generate1099INT({
            account: savings,
            year: taxYear,
            interestEarned: interest,
            recipientName: "Account Holder",
          });
          toast.success(`1099-INT ${taxYear} downloaded`);
        },
      });
    }

    // --- Standing agreements & notices -----------------------------------
    const disclosures: Array<{ name: string; category: Category; date: string; body: string; icon: typeof FileText }> = [
      {
        name: "Account Opening Disclosure",
        category: "Agreements",
        date: accounts.checking.openedDate || "Jan 15, 2024",
        body: "Terms, fee schedule, and account agreement disclosed at account opening.",
        icon: Shield,
      },
      {
        name: "E-Sign Consent",
        category: "Agreements",
        date: accounts.checking.openedDate || "Jan 15, 2024",
        body: "Your consent to receive statements, notices, and agreements electronically.",
        icon: Shield,
      },
      {
        name: "Privacy Policy Update",
        category: "Notices",
        date: "Dec 15, 2025",
        body: "Updated privacy practices governing how Glass Bank collects and uses your information.",
        icon: Bell,
      },
    ];

    disclosures.forEach((d, idx) => {
      list.push({
        id: `disc-${idx}`,
        name: d.name,
        category: d.category,
        date: d.date,
        account: "All",
        read: true,
        icon: d.icon,
        download: () => {
          const blob = new Blob(
            [`Glass Bank\n${d.name}\nIssued: ${d.date}\n\n${d.body}\n`],
            { type: "application/pdf" }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${d.name.replace(/[^\w]+/g, "_")}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast.success(`Downloaded ${d.name}`);
        },
      });
    });

    return list;
  }, [accounts, transactions]);

  const filtered = rows.filter((d) => {
    const matchCat = activeCategory === "All" || d.category === activeCategory;
    const matchSearch = !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Documents</h1>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search documents..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" />
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {cat}
            </button>
          ))}
        </div>

        <GlassCard className="divide-y divide-border p-0 overflow-hidden">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No documents match your search.</div>
          )}
          {filtered.map((doc) => {
            const Icon = doc.icon;
            return (
              <button
                key={doc.id}
                onClick={doc.download}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon size={20} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      {!doc.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{doc.date} · {doc.account}</p>
                  </div>
                </div>
                <Download size={16} className="text-muted-foreground shrink-0 ml-2" />
              </button>
            );
          })}
        </GlassCard>
      </div>
    </div>
  );
};

export default Documents;
