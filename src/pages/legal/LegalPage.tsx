import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";
import Seo from "@/components/Seo";

/**
 * Shared shell for the public legal pages. Deliberately a plain, readable
 * document layout rather than the glass dashboard chrome — legal text should
 * look like legal text, and these routes are reachable while signed out.
 */
const LegalPage = ({
  title,
  description,
  updated,
  children,
}: {
  title: string;
  description: string;
  updated: string;
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <main className="min-h-screen bg-background">
      <Seo title={`${title} · Glass Bank`} description={description} path={pathname} />

      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 py-10 sm:py-16">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            <FileText size={13} className="text-primary" /> Legal
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-display font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Last updated {updated}</p>
        </header>

        {/* Honest posture: these are structured drafts, not counsel-reviewed
            terms. Saying so is better than implying legal review happened. */}
        <div className="mb-10 flex gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Draft pending legal review</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This document describes how Glass Bank actually operates today, but it has not been
              reviewed by counsel and is not yet a binding agreement. Do not rely on it as final
              legal terms. It will be replaced with a reviewed version before public launch.
            </p>
          </div>
        </div>

        <div className="space-y-8">{children}</div>

        <footer className="mt-14 border-t border-border pt-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/legal/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/legal/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/privacy-center" className="hover:text-foreground transition-colors">Privacy Center</Link>
          </div>
          <p className="mt-4 leading-relaxed">
            Glass Bank is a financial technology company, not a bank. Banking services provided by
            Column N.A., Member FDIC.
          </p>
        </footer>
      </div>
    </main>
  );
};

export const LegalSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:text-foreground [&_strong]:font-medium">
      {children}
    </div>
  </section>
);

export default LegalPage;
