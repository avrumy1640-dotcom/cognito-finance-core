import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { ArrowLeft, FileText, Download, Search, ChevronRight } from "lucide-react";

const categories = ["All", "Statements", "Tax Forms", "Notices", "Agreements"];

const documents = [
  { id: "d1", name: "March 2026 Statement", category: "Statements", date: "Apr 1, 2026", account: "Checking", read: false },
  { id: "d2", name: "February 2026 Statement", category: "Statements", date: "Mar 1, 2026", account: "Checking", read: true },
  { id: "d3", name: "1099-INT Tax Form (2025)", category: "Tax Forms", date: "Jan 31, 2026", account: "Savings", read: true },
  { id: "d4", name: "Account Opening Disclosure", category: "Agreements", date: "Jan 15, 2024", account: "All", read: true },
  { id: "d5", name: "Privacy Policy Update", category: "Notices", date: "Dec 15, 2025", account: "All", read: true },
  { id: "d6", name: "E-Sign Consent", category: "Agreements", date: "Jan 15, 2024", account: "All", read: true },
  { id: "d7", name: "January 2026 Statement", category: "Statements", date: "Feb 1, 2026", account: "Checking", read: true },
  { id: "d8", name: "Savings Statement — Q4 2025", category: "Statements", date: "Jan 5, 2026", account: "Savings", read: true },
];

const Documents = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = documents.filter((d) => {
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
          {filtered.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText size={20} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    {!doc.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{doc.date} · {doc.account}</p>
                </div>
              </div>
              <Download size={16} className="text-muted-foreground shrink-0 ml-2" />
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
};

export default Documents;
