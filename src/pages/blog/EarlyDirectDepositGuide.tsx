import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import JsonLd from "@/components/JsonLd";

const STEPS = [
  {
    name: "Grab your account and routing numbers",
    text: "Open Glass Bank and go to Direct Deposit. Your routing number and account number are shown exactly as issued by our banking partner — copy both, or download the prefilled direct deposit form.",
  },
  {
    name: "Give the details to whoever runs payroll",
    text: "Most employers accept the prefilled PDF. If yours uses a payroll portal (Workday, ADP, Gusto, Rippling), paste the routing and account numbers into the direct deposit section and choose 'checking'.",
  },
  {
    name: "Choose full or split deposit",
    text: "You can send 100% of your pay to Glass Bank, or split a fixed amount or percentage between Glass Bank and another account while you make the switch.",
  },
  {
    name: "Wait one pay cycle",
    text: "Payroll systems usually apply the change on the next cycle. Keep the old account open until you've seen one full paycheck land at Glass Bank.",
  },
  {
    name: "Get paid up to two days early",
    text: "Once your employer's ACH credit arrives, Glass Bank releases the funds as soon as the payment file is received instead of waiting for the official settlement date — typically up to two days early, at no cost.",
  },
];

const FAQS = [
  {
    q: "How does early direct deposit actually work?",
    a: "Employers submit payroll to the ACH network a day or two before payday. Banks receive that file early but many hold the money until the settlement date. Glass Bank posts the credit as soon as the file arrives, so your pay shows up early.",
  },
  {
    q: "Is early direct deposit a loan or an advance?",
    a: "No. It is not credit and there is nothing to pay back. It is simply your own payroll credit released as soon as it reaches us, so there is no interest and no fee.",
  },
  {
    q: "Will I always get paid exactly two days early?",
    a: "Up to two days early. The exact timing depends on when your employer submits payroll. Some employers file the morning of payday, in which case there's nothing to release early.",
  },
  {
    q: "Do government benefits and tax refunds arrive early too?",
    a: "Yes. Social Security, unemployment and IRS refunds sent by ACH are released the same way, as soon as the payment file reaches us.",
  },
  {
    q: "What if my employer doesn't offer direct deposit?",
    a: "You can still receive ACH credits from any sender using the same routing and account numbers, including client payments and transfers from another bank.",
  },
];

const EarlyDirectDepositGuide = () => (
  <div className="min-h-dvh bg-background">
    <Seo
      title="Early Direct Deposit: How to Set It Up (2026 Guide)"
      description="A step-by-step guide to setting up early direct deposit: how early ACH payroll works, how to switch your paycheck to Glass Bank, and when the money actually lands."
      path="/blog/early-direct-deposit-guide"
    />
    <JsonLd
      id="ld-early-direct-deposit"
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "Early Direct Deposit: How to Set It Up",
            description:
              "How early direct deposit works and how to switch your paycheck so it arrives up to two days early.",
            author: { "@type": "Organization", name: "Glass Bank" },
            publisher: { "@type": "Organization", name: "Glass Bank" },
            mainEntityOfPage: "https://financial.norvenhealth.com/blog/early-direct-deposit-guide",
          },
          {
            "@type": "HowTo",
            name: "How to set up early direct deposit",
            step: STEPS.map((s, i) => ({
              "@type": "HowToStep",
              position: i + 1,
              name: s.name,
              text: s.text,
            })),
          },
          {
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ],
      }}
    />

    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <p className="kicker text-primary">Guide</p>
      <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-foreground">
        Early direct deposit: how to set it up and get paid up to two days early
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        "Early direct deposit" isn't a gimmick and it isn't an advance. It's what happens when a bank
        posts your payroll credit the moment the ACH file arrives instead of sitting on it until the
        official settlement date. Here's exactly how the mechanics work, and how to move your paycheck
        to Glass Bank in one pay cycle.
      </p>

      <h2 className="mt-10 font-display text-xl font-bold text-foreground">How early ACH payroll works</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your employer sends a payroll file into the ACH network ahead of payday — usually one to two
        business days. That file contains the effective date (payday) and the amount. Every receiving
        bank sees the credit before the effective date. Banks that wait for settlement pay you on
        payday; banks that release on receipt pay you when the file lands. Glass Bank does the latter,
        which is where the "up to two days early" comes from. Nothing is fronted, so there is no fee
        and no interest.
      </p>

      <h2 className="mt-10 font-display text-xl font-bold text-foreground">Set it up in five steps</h2>
      <ol className="mt-4 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.name} className="rounded-2xl bg-card p-5 shadow-sm">
            <p className="font-display text-sm font-bold text-foreground">
              {i + 1}. {s.name}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 font-display text-xl font-bold text-foreground">Common questions</h2>
      <div className="mt-4 space-y-4">
        {FAQS.map((f) => (
          <div key={f.q}>
            <h3 className="text-sm font-semibold text-foreground">{f.q}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl bg-secondary p-6">
        <p className="font-display text-base font-bold text-foreground">Ready to switch your paycheck?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a Glass Bank account, then find your routing and account numbers under Direct Deposit.
        </p>
        <Link
          to="/signup"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Open an account
        </Link>
      </div>
    </main>
  </div>
);

export default EarlyDirectDepositGuide;
