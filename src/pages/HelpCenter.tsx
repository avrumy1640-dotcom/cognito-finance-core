import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { faqData } from "@/data/mockData";
import {
  ArrowLeft,
  Search,
  MessageCircle,
  Phone,
  Mail,
  ChevronDown,
  HelpCircle,
  Shield,
  CreditCard,
  ArrowLeftRight,
  FileText,
  AlertTriangle,
} from "lucide-react";

const HelpCenter = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  const supportTopics = [
    { icon: HelpCircle, label: "Account Access", match: ["Account", "Access"] },
    { icon: ArrowLeftRight, label: "Transfers & Payments", match: ["Send", "Transfer"] },
    { icon: CreditCard, label: "Cards & Purchases", match: ["Card"] },
    { icon: Shield, label: "Security & Fraud", match: ["Security"] },
    { icon: FileText, label: "Statements & Tax", match: ["Statement", "Tax"] },
    { icon: AlertTriangle, label: "Disputes & Issues", match: ["Dispute"] },
  ];

  const contact = {
    Chat: () => toast.success("Starting secure chat with a specialist… avg wait 45s"),
    Call: () => { window.location.href = "tel:+18005555555"; toast.info("Calling 1-800-555-5555"); },
    Message: () => { window.location.href = "mailto:support@glassbank.com"; toast.info("Opening secure message"); },
  } as const;

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqData
      .filter((s) => !topicFilter || supportTopics.find((t) => t.label === topicFilter)?.match.some((m) => s.category.toLowerCase().includes(m.toLowerCase())))
      .map((s) => ({
        ...s,
        items: s.items.filter((it) => !q || it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, topicFilter]);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Help Center</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="How can we help?"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
          />
        </div>

        {/* Contact */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: MessageCircle, label: "Chat" },
            { icon: Phone, label: "Call" },
            { icon: Mail, label: "Message" },
          ].map((item) => (
            <GlassCard key={item.label} className="text-center py-4">
              <item.icon size={22} className="text-primary mx-auto mb-1.5" />
              <span className="text-xs font-medium text-foreground">{item.label}</span>
            </GlassCard>
          ))}
        </div>

        {/* Topics */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Topics</h2>
          <div className="grid grid-cols-2 gap-2">
            {supportTopics.map((topic) => (
              <GlassCard key={topic.label} className="flex items-center gap-2 py-3">
                <topic.icon size={18} className="text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{topic.label}</span>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Frequently Asked Questions</h2>
          {faqData.map((section) => (
            <div key={section.category} className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 px-1">{section.category}</h3>
              <GlassCard className="divide-y divide-border p-0 overflow-hidden">
                {section.items.map((item) => {
                  const key = `${section.category}-${item.q}`;
                  const isOpen = expandedFaq === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setExpandedFaq(isOpen ? null : key)}
                      className="w-full text-left px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground pr-2">{item.q}</span>
                        <ChevronDown
                          size={16}
                          className={`text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      {isOpen && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="text-sm text-muted-foreground mt-2 leading-relaxed"
                        >
                          {item.a}
                        </motion.p>
                      )}
                    </button>
                  );
                })}
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
