import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Gift,
  ShieldCheck,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import Seo from "@/components/Seo";

/* ---------------------------------------------------------------
   Pre-login intro carousel. Purely additive: it never mutates any
   app state beyond a "seen" flag, and both CTAs jump straight into
   the existing auth flow.
---------------------------------------------------------------- */

const INTRO_SEEN_KEY = "gb_intro_seen";

const PhoneFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto w-[210px] sm:w-[230px]">
    <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_30%,hsl(82_92%_62%/0.14),transparent_70%)]" />
    <div className="rounded-[2.2rem] border border-border/70 bg-card/60 p-2 shadow-2xl backdrop-blur-xl">
      <div className="glow-surface gradient-hero relative h-[330px] overflow-hidden rounded-[1.75rem] border border-white/10 p-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        {children}
      </div>
    </div>
  </div>
);

const MiniCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`glass-card rounded-2xl p-3 ${className}`}>{children}</div>
);

const Bar = ({ pct }: { pct: number }) => (
  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className="h-full rounded-full gradient-lime"
    />
  </div>
);

const GoalsMock = () => (
  <div className="space-y-2.5 text-white">
    <p className="kicker text-white/60">Savings goals</p>
    <MiniCard>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold">Emergency fund</span>
        <span className="text-white/70">$2,400 / $5,000</span>
      </div>
      <Bar pct={48} />
    </MiniCard>
    <MiniCard>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold">Japan trip</span>
        <span className="text-white/70">$1,150 / $3,000</span>
      </div>
      <Bar pct={38} />
    </MiniCard>
    <MiniCard>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold">New laptop</span>
        <span className="text-white/70">$780 / $1,200</span>
      </div>
      <Bar pct={65} />
    </MiniCard>
    <MiniCard className="flex items-center gap-2">
      <Target size={14} className="text-primary" />
      <span className="text-[10px] text-white/80">Round-ups added $18.42 this week</span>
    </MiniCard>
  </div>
);

const EarlyPayMock = () => (
  <div className="space-y-3 text-white">
    <p className="kicker text-white/60">Direct deposit</p>
    <MiniCard className="text-center">
      <p className="text-[10px] text-white/60">Paycheck arriving</p>
      <p className="text-balance-display mt-1 text-2xl">$2,184.30</p>
      <p className="mt-1 text-[10px] text-primary">Up to 2 days early</p>
    </MiniCard>
    <MiniCard>
      <div className="flex items-center justify-between text-[10px] text-white/75">
        <span>Routing</span><span className="font-mono">084106768</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/75">
        <span>Account</span><span className="font-mono">•••• 4192</span>
      </div>
    </MiniCard>
    <MiniCard className="flex items-center gap-2">
      <Zap size={14} className="text-primary" />
      <span className="text-[10px] text-white/80">Employer setup in one tap</span>
    </MiniCard>
  </div>
);

const CreditMock = () => (
  <div className="space-y-3 text-white">
    <p className="kicker text-white/60">Credit builder</p>
    <MiniCard className="text-center">
      <svg viewBox="0 0 120 68" className="mx-auto w-[130px]">
        <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="9" strokeLinecap="round" />
        <motion.path
          d="M10 62 A50 50 0 0 1 110 62"
          fill="none"
          stroke="hsl(82 92% 62%)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="157"
          initial={{ strokeDashoffset: 157 }}
          animate={{ strokeDashoffset: 46 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <p className="text-balance-display -mt-3 text-2xl">728</p>
      <p className="text-[10px] text-white/60">Very good</p>
    </MiniCard>
    <MiniCard className="flex items-center justify-between text-[10px]">
      <span className="text-white/75">On-time payments</span>
      <span className="text-primary">100%</span>
    </MiniCard>
    <MiniCard className="flex items-center gap-2">
      <TrendingUp size={14} className="text-primary" />
      <span className="text-[10px] text-white/80">+22 pts in the last 3 months</span>
    </MiniCard>
  </div>
);

const RewardsMock = () => (
  <div className="space-y-3 text-white">
    <p className="kicker text-white/60">Rewards</p>
    <MiniCard className="text-center">
      <p className="text-[10px] text-white/60">Cashback earned</p>
      <p className="text-balance-display mt-1 text-2xl">$146.80</p>
      <Bar pct={72} />
    </MiniCard>
    {[
      ["Groceries", "1% back", "$12.40"],
      ["Fuel", "1% back", "$6.15"],
      ["Streaming", "1% back", "$1.99"],
    ].map(([a, b, c]) => (
      <MiniCard key={a} className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold">{a}</p>
          <p className="text-[9px] text-white/55">{b}</p>
        </div>
        <span className="text-[11px] text-primary">{c}</span>
      </MiniCard>
    ))}
  </div>
);

const SecurityMock = () => (
  <div className="space-y-3 text-white">
    <p className="kicker text-white/60">Protection</p>
    <MiniCard className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl gradient-lime">
        <ShieldCheck size={22} className="text-primary-foreground" />
      </div>
      <p className="mt-2 text-[11px] font-semibold">Overdraft cushion active</p>
      <p className="text-[10px] text-white/60">Up to $200, no fees</p>
    </MiniCard>
    <MiniCard className="flex items-center justify-between">
      <span className="text-[10px] text-white/80">Biometric app lock</span>
      <span className="h-4 w-7 rounded-full gradient-lime" />
    </MiniCard>
    <MiniCard className="flex items-center justify-between">
      <span className="text-[10px] text-white/80">Real-time alerts</span>
      <span className="h-4 w-7 rounded-full gradient-lime" />
    </MiniCard>
    <MiniCard className="flex items-center gap-2">
      <CreditCard size={14} className="text-primary" />
      <span className="text-[10px] text-white/80">Freeze your card instantly</span>
    </MiniCard>
  </div>
);

interface Slide {
  id: string;
  kicker: string;
  title: string;
  body: string;
  icon: typeof Target;
  mock: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    id: "goals",
    kicker: "Save automatically",
    title: "Goals that fill\nthemselves",
    body: "Set a target, turn on round-ups, and every purchase quietly pushes you closer.",
    icon: Target,
    mock: <GoalsMock />,
  },
  {
    id: "early-pay",
    kicker: "Direct deposit",
    title: "Get paid up to\n2 days early",
    body: "Set up direct deposit once and your paycheck lands the moment your employer sends it.",
    icon: Zap,
    mock: <EarlyPayMock />,
  },
  {
    id: "credit",
    kicker: "Credit building",
    title: "Build credit as\nyou spend",
    body: "Track your score in-app and watch it move with every on-time payment you make.",
    icon: BadgeCheck,
    mock: <CreditMock />,
  },
  {
    id: "rewards",
    kicker: "Rewards",
    title: "Cashback on\neveryday spend",
    body: "Earn on groceries, fuel, and subscriptions — credited straight back to your balance.",
    icon: Gift,
    mock: <RewardsMock />,
  },
  {
    id: "security",
    kicker: "Peace of mind",
    title: "Protected from\nevery angle",
    body: "No-fee overdraft cushion, biometric lock, and real-time alerts on every transaction.",
    icon: ShieldCheck,
    mock: <SecurityMock />,
  },
];

const Intro = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    try { localStorage.setItem(INTRO_SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
    setDir(clamped >= index ? 1 : -1);
    setIndex(clamped);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div className="ambient-glow relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <Seo
        title="Glass Bank — Save, spend and build credit"
        description="See what Glass Bank does: automatic savings goals, direct deposit up to 2 days early, credit building, cashback rewards and a no-fee overdraft cushion."
        path="/intro"
      />

      <header className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
            <span className="font-display text-sm font-bold text-primary-foreground">G</span>
          </div>
          <span className="font-display text-sm font-semibold text-foreground">Glass Bank</span>
        </div>
        <button
          onClick={() => navigate("/welcome")}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </header>

      <div
        className="flex flex-1 flex-col"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={slide.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(index + 1);
              else if (info.offset.x > 60) go(index - 1);
            }}
            className="flex flex-1 flex-col"
          >
            <div className="flex flex-[0_0_auto] items-center justify-center px-6 pt-6 pb-4">
              <PhoneFrame>{slide.mock}</PhoneFrame>
            </div>

            <div className="mx-auto w-full max-w-md px-7 pt-2">
              <div className="flex items-center gap-2">
                <Icon size={14} className="text-primary" />
                <span className="kicker text-primary">{slide.kicker}</span>
              </div>
              <h1 className="mt-2 whitespace-pre-line font-display text-[2rem] font-bold leading-[1.08] tracking-tight text-foreground">
                {slide.title}
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{slide.body}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mx-auto flex w-full max-w-md items-center justify-center gap-2 py-5">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}: ${s.kicker}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/35"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="safe-bottom mx-auto w-full max-w-md space-y-3 px-7 pb-6">
        <button
          onClick={() => navigate("/signup")}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Sign up <ArrowRight size={16} />
        </button>
        <button
          onClick={() => navigate("/login")}
          className="min-h-[52px] w-full rounded-xl bg-secondary px-4 text-sm font-semibold text-foreground"
        >
          Log in
        </button>
      </div>
    </div>
  );
};

export default Intro;
