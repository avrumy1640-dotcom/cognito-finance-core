import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Car,
  Coins,
  CreditCard,
  Fingerprint,
  Gift,
  Home,
  Plane,
  PlusCircle,
  Repeat,
  ShieldCheck,
  ShoppingBag,
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

/* ---------------- 3D tilted phone ---------------- */

/* Apple-style continuous corners: elliptical radii approximate the squircle
   far better than a uniform rounded-rect. */
const SQUIRCLE = "13.5% / 6.4%";
const SQUIRCLE_INNER = "12.8% / 6.1%";

/* recessed metal side button rendered on the visible left edge slab */
const EdgeButton = ({ top, height }: { top: number; height: number }) => (
  <div
    className="absolute left-[3px] right-[3px] rounded-[2.5px]"
    style={{
      top,
      height,
      background:
        "linear-gradient(90deg, hsl(220 8% 22%) 0%, hsl(220 10% 70%) 30%, hsl(0 0% 92%) 52%, hsl(220 10% 46%) 74%, hsl(220 8% 20%) 100%)",
      boxShadow:
        "0 -1.5px 1.5px hsl(0 0% 0% / 0.7), 0 1.5px 1.5px hsl(0 0% 0% / 0.7), inset 0 0 0 0.5px hsl(0 0% 100% / 0.4)",
    }}
  />
);


/* Breakpoint-aware presentation: the mock scales as a whole (so the fixed-px
   screen content stays proportional and readable) and the perspective grows
   with it so the tilt never looks warped on wide screens. */
type Stage = { zoom: number; perspective: number; baseRotY: number; baseRotX: number };

const STAGES: Record<"mobile" | "tablet" | "desktop", Stage> = {
  mobile: { zoom: 1, perspective: 900, baseRotY: 23, baseRotX: 6 },
  tablet: { zoom: 1.3, perspective: 1500, baseRotY: 26, baseRotX: 6.5 },
  desktop: { zoom: 1.55, perspective: 2000, baseRotY: 29, baseRotX: 7 },
};

const useStage = (): Stage => {
  const [key, setKey] = useState<"mobile" | "tablet" | "desktop">("mobile");
  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 640px)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => setKey(desktop.matches ? "desktop" : tablet.matches ? "tablet" : "mobile");
    sync();
    tablet.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      tablet.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);
  return STAGES[key];
};

const PhoneFrame = ({ children }: { children: React.ReactNode }) => {
  const { reducedMotion: reduceMotion } = useReducedMotionPref();
  const stage = useStage();

  /* normalized pointer position, -0.5 .. 0.5 */
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const spring = { stiffness: 140, damping: 18, mass: 0.35 };
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);

  const rotateY = useTransform(sx, (v) => stage.baseRotY + v * 11);
  const rotateX = useTransform(sy, (v) => stage.baseRotX - v * 9);
  const rotateZ = useTransform(sx, (v) => -2 + v * 2);
  const translateX = useTransform(sx, (v) => 8 + v * 6);

  /* the highlight sweeps across the metal / glass as the phone turns */
  const glarePos = useTransform(sx, (v) => `${50 - v * 60}%`);
  const glareOpacity = useTransform(sy, (v) => 0.85 + v * 0.25);
  const bezelPos = useTransform(sx, (v) => `${50 + v * 45}%`);

  /* contact shadow drifts opposite the tilt and softens as the phone lifts */
  const shadowX = useTransform(sx, (v) => v * -26);
  const shadowScale = useTransform(sy, (v) => 1 + v * 0.12);
  const shadowOpacity = useTransform(sx, (v) => 0.7 - Math.abs(v) * 0.18);

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5)));
    py.set(Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5)));
  };
  const resetPointer = () => {
    px.set(0);
    py.set(0);
  };

  return (
  <div
    className="relative w-full touch-pan-y"
    style={{
      perspective: `${stage.perspective}px`,
      perspectiveOrigin: "62% 38%",
      zoom: stage.zoom,
    }}
    onPointerMove={handlePointer}
    onPointerLeave={resetPointer}
    onPointerCancel={resetPointer}
    onPointerUp={resetPointer}
  >
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative mx-auto w-[196px]"
      style={{ transformStyle: "preserve-3d" }}
    >

    <motion.div
      className="relative [will-change:transform]"
      style={{
        transformStyle: "preserve-3d",
        rotateX,
        rotateY,
        rotateZ,
        translateX,
      }}
    >
      {/* ambient contact shadow, offset along the tilt direction */}
      <motion.div
        className="pointer-events-none absolute -bottom-8 -left-2 right-8 h-20 rounded-[50%] bg-black blur-2xl"
        style={{ x: shadowX, scaleY: shadowScale, opacity: shadowOpacity }}
      />


      {/* ---- left side body slab (gives real thickness on the edge facing us) ---- */}
      <div
        className="pointer-events-none absolute bottom-[7px] left-0 top-[7px] w-[22px] rounded-[7px]"
        style={{
          transformOrigin: "left center",
          transform: "rotateY(90deg)",
          background:
            "linear-gradient(90deg, hsl(220 12% 7%) 0%, hsl(220 10% 34%) 16%, hsl(220 8% 74%) 38%, hsl(0 0% 96%) 47%, hsl(220 9% 48%) 66%, hsl(220 12% 18%) 88%, hsl(220 14% 8%) 100%)",
        }}
      >
        {/* volume up / volume down / power live on the visible edge */}
        <EdgeButton top={82} height={26} />
        <EdgeButton top={116} height={26} />
        <EdgeButton top={162} height={38} />
      </div>


      {/* ---- titanium bezel / body ---- */}
      <div
        className="relative p-[2.5px]"
        style={{
          borderRadius: SQUIRCLE,
          background:
            "linear-gradient(122deg, hsl(220 14% 10%) 0%, hsl(220 10% 52%) 8%, hsl(0 0% 94%) 14%, hsl(220 12% 38%) 26%, hsl(220 16% 11%) 52%, hsl(220 10% 44%) 74%, hsl(0 0% 88%) 88%, hsl(220 14% 12%) 100%)",
          boxShadow:
            "0 48px 80px -26px hsl(224 60% 2% / 0.9), 0 12px 30px -10px hsl(224 60% 2% / 0.75), inset 0 0 0 0.5px hsl(0 0% 100% / 0.22)",
        }}
      >
        {/* travelling specular highlight on the metal frame */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            borderRadius: SQUIRCLE,
            backgroundImage:
              "radial-gradient(60% 40% at var(--bezel-x) 12%, hsl(0 0% 100% / 0.55), transparent 70%)",
            ["--bezel-x" as string]: bezelPos,
            mixBlendMode: "screen",
          }}
        />

        {/* inner chamfer line */}
        <div
          className="pointer-events-none absolute inset-[1.5px] z-20"
          style={{ borderRadius: SQUIRCLE_INNER, boxShadow: "inset 0 0 0 0.75px hsl(0 0% 0% / 0.85)" }}
        />

        <div
          className="relative overflow-hidden bg-[hsl(224_48%_5%)] [isolation:isolate]"
          style={{ borderRadius: SQUIRCLE_INNER }}
        >
          {/* dynamic island — real proportions */}
          <div className="absolute left-1/2 top-[9px] z-30 h-[15px] w-[54px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_0.5px_hsl(0_0%_100%/0.07)]">
            <span className="absolute right-[7px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-[hsl(224_28%_16%)] ring-[0.5px] ring-white/10" />
          </div>

          {/* screen — 9 : 19.5 */}
          <div className="gradient-hero relative aspect-[9/19.5] w-full overflow-hidden px-3.5 pb-4 pt-8 text-white">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(82_92%_62%/0.22),transparent_70%)]" />
            {/* status bar */}
            <div className="relative mb-2 flex items-center justify-between px-1 text-[9px] font-semibold tracking-tight text-white/85">
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-[7px] w-[10px] rounded-[1px] bg-white/70" />
                <span className="inline-block h-[7px] w-[14px] rounded-[2px] border border-white/60" />
              </span>
            </div>
            <div className="relative h-[calc(100%-1.75rem)] overflow-hidden">{children}</div>
            {/* home indicator */}
            <div className="absolute bottom-1.5 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-white/40" />
          </div>

          {/* glass glare across the display */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 [will-change:opacity]"
            style={{
              borderRadius: SQUIRCLE_INNER,
              backgroundImage:
                "linear-gradient(108deg, hsl(0 0% 100% / 0.20) 0%, hsl(0 0% 100% / 0.07) 16%, transparent 34%, transparent 62%, hsl(0 0% 100% / 0.05) 84%, hsl(0 0% 100% / 0.12) 100%)",
              backgroundSize: "220% 100%",
              backgroundPositionX: glarePos,
              opacity: glareOpacity,
            }}
          />
        </div>
      </div>
    </motion.div>
    </motion.div>

  </div>
  );
};



/* ---------------- shared screen primitives ---------------- */

const Row = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-white/10 bg-white/[0.07] px-2.5 py-2 ${className}`}>{children}</div>
);

const ScreenHeader = ({ title, sub }: { title: string; sub: string }) => (
  <div className="mb-2 flex items-center justify-between">
    <div>
      <p className="text-[7.5px] uppercase tracking-[0.16em] text-white/45">{sub}</p>
      <p className="font-display text-[14px] font-bold leading-tight">{title}</p>
    </div>
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
      <Bell size={11} className="text-white/70" />
    </div>
  </div>
);

const Bar = ({ pct, delay = 0 }: { pct: number; delay?: number }) => (
  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.9, delay, ease: "easeOut" }}
      className="gradient-lime h-full rounded-full"
    />
  </div>
);

/* ---------------- slide screens ---------------- */

const GoalsMock = () => (
  <div className="space-y-2">
    <ScreenHeader sub="Savings" title="Your goals" />
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <p className="text-[8px] text-white/55">Total saved</p>
      <p className="text-balance-display mt-0.5 text-[26px] leading-none">$4,330.00</p>
      <p className="mt-1.5 text-[8px] text-primary">+$182.40 this month</p>
      <Bar pct={54} />
    </div>
    {[
      [Home, "Emergency fund", "$2,400", "$5,000", 48],
      [Plane, "Japan trip", "$1,150", "$3,000", 38],
      [Car, "New car fund", "$780", "$1,200", 65],
      [ShoppingBag, "Holiday gifts", "$220", "$600", 36],
    ].map(([Icon, name, cur, tgt, pct], i) => {
      const I = Icon as typeof Home;
      return (
        <Row key={name as string}>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <I size={11} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[9.5px]">
                <span className="truncate font-semibold">{name as string}</span>
                <span className="shrink-0 whitespace-nowrap text-white/60">
                  {cur as string} / {tgt as string}
                </span>
              </div>
              <Bar pct={pct as number} delay={0.1 * i} />
            </div>
          </div>
        </Row>
      );
    })}
    <Row className="flex items-center gap-2">
      <Repeat size={11} className="text-primary" />
      <span className="text-[8.5px] text-white/75">Round-ups added $18.42 this week</span>
    </Row>
  </div>
);

const EarlyPayMock = () => (
  <div className="space-y-2">
    <ScreenHeader sub="Direct deposit" title="Get paid early" />
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center">
      <p className="text-[8px] text-white/55">Paycheck arriving</p>
      <p className="text-balance-display mt-0.5 text-[26px] leading-none">$2,184.30</p>
      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[8px] text-primary">
        <Zap size={9} /> Up to 2 days early
      </p>
    </div>
    <Row>
      <p className="mb-1 text-[8px] uppercase tracking-[0.14em] text-white/45">Account details</p>
      <div className="flex items-center justify-between text-[9px] text-white/75">
        <span>Routing</span>
        <span className="font-mono">084106768</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[9px] text-white/75">
        <span>Account</span>
        <span className="font-mono">•••• 4192</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[9px] text-white/75">
        <span>Type</span>
        <span>Checking</span>
      </div>
    </Row>
    <p className="px-1 pt-0.5 text-[8px] uppercase tracking-[0.14em] text-white/45">Recent deposits</p>
    {[
      ["Acme Corp payroll", "Jul 26", "+$2,184.30"],
      ["Acme Corp payroll", "Jul 12", "+$2,184.30"],
      ["Side gig transfer", "Jul 05", "+$420.00"],
    ].map(([m, d, a]) => (
      <Row key={d} className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-[9.5px] font-semibold">{m}</p>
          <p className="text-[8px] text-white/50">{d}</p>
        </div>
        <span className="text-[9.5px] font-semibold text-primary">{a}</span>
      </Row>
    ))}
  </div>
);

const CreditMock = () => (
  <div className="space-y-2">
    <ScreenHeader sub="Credit builder" title="Your score" />
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center">
      <svg viewBox="0 0 120 68" className="mx-auto w-[132px]">
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
      <p className="text-balance-display -mt-4 text-[26px] leading-none">728</p>
      <p className="mt-0.5 text-[8px] text-white/55">Very good · updated today</p>
    </div>
    <Row className="flex items-center gap-2">
      <TrendingUp size={11} className="text-primary" />
      <span className="text-[8.5px] text-white/80">+22 pts in the last 3 months</span>
    </Row>
    <p className="px-1 pt-0.5 text-[8px] uppercase tracking-[0.14em] text-white/45">Score factors</p>
    {[
      ["On-time payments", "100%", 100],
      ["Credit utilization", "12%", 88],
      ["Account age", "3y 2m", 62],
      ["Recent inquiries", "1", 76],
    ].map(([label, val, pct], i) => (
      <Row key={label as string}>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="font-semibold">{label as string}</span>
          <span className="text-primary">{val as string}</span>
        </div>
        <Bar pct={pct as number} delay={0.08 * i} />
      </Row>
    ))}
  </div>
);

const RewardsMock = () => (
  <div className="space-y-2">
    <ScreenHeader sub="Glass Card" title="Cashback" />
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <div className="flex items-center gap-1.5">
        <Coins size={11} className="text-primary" />
        <p className="text-[8px] text-white/55">Available to redeem</p>
      </div>
      <p className="text-balance-display mt-0.5 text-[26px] leading-none">$146.80</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.07] p-1.5">
          <p className="text-[7.5px] text-white/50">This month</p>
          <p className="text-[11px] font-semibold">$24.16</p>
        </div>
        <div className="rounded-lg bg-white/[0.07] p-1.5">
          <p className="text-[7.5px] text-white/50">All time</p>
          <p className="text-[11px] font-semibold">$612.40</p>
        </div>
      </div>
      <div className="gradient-lime mt-2 rounded-lg py-1.5 text-center text-[9px] font-semibold text-primary-foreground">
        Redeem to checking
      </div>
    </div>
    <p className="px-1 text-[8px] uppercase tracking-[0.14em] text-white/45">Recent earnings</p>
    {[
      [ShoppingBag, "Whole Foods", "$124.00", "+$1.24"],
      [Car, "Shell Fuel", "$61.50", "+$0.62"],
      [CreditCard, "Netflix", "$19.99", "+$0.20"],
      [ShoppingBag, "Target", "$88.40", "+$0.88"],
    ].map(([Icon, m, spend, earned]) => {
      const I = Icon as typeof Home;
      return (
        <Row key={m as string} className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <I size={11} className="text-white/70" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[9.5px] font-semibold">{m as string}</p>
              <p className="text-[8px] text-white/50">{spend as string} · 1% back</p>
            </div>
          </div>
          <span className="text-[9.5px] font-semibold text-primary">{earned as string}</span>
        </Row>
      );
    })}
  </div>
);

const SecurityMock = () => (
  <div className="space-y-2">
    <ScreenHeader sub="Protection" title="Security center" />
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center">
      <div className="gradient-lime mx-auto flex h-11 w-11 items-center justify-center rounded-2xl">
        <ShieldCheck size={20} className="text-primary-foreground" />
      </div>
      <p className="mt-1.5 text-[11px] font-semibold">Overdraft cushion active</p>
      <p className="text-[8px] text-white/55">Up to $200, no fees</p>
    </div>
    {[
      [Fingerprint, "Biometric app lock", true],
      [Bell, "Real-time alerts", true],
      [ShieldCheck, "Two-factor auth", true],
      [CreditCard, "Card freeze", false],
    ].map(([Icon, label, on]) => {
      const I = Icon as typeof Home;
      return (
        <Row key={label as string} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <I size={11} className="text-white/70" />
            <span className="text-[9.5px] font-semibold">{label as string}</span>
          </div>
          <span
            className={`flex h-4 w-7 items-center rounded-full px-0.5 ${on ? "gradient-lime justify-end" : "justify-start bg-white/15"}`}
          >
            <span className="h-3 w-3 rounded-full bg-white" />
          </span>
        </Row>
      );
    })}
    <Row className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-[9.5px] font-semibold">iPhone 16 Pro</p>
        <p className="text-[8px] text-white/50">New York · Active now</p>
      </div>
      <ArrowUpRight size={11} className="text-white/50" />
    </Row>
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <Seo
        title="Glass Bank — Save, spend and build credit"
        description="See what Glass Bank does: automatic savings goals, direct deposit up to 2 days early, credit building, cashback rewards and a no-fee overdraft cushion."
        path="/intro"
      />

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
        {/* ---- full-bleed hero stage ---- */}
        <div className="gradient-hero relative overflow-hidden rounded-b-[2.5rem] pb-10">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(82_92%_62%/0.20),transparent_68%)]" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,hsl(82_92%_62%/0.12),transparent_70%)]" />

          <header className="relative flex items-center justify-between px-6 pt-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
                <span className="font-display text-sm font-bold text-primary-foreground">G</span>
              </div>
              <span className="font-display text-sm font-semibold text-white">Glass Bank</span>
            </div>
            <button
              onClick={() => navigate("/welcome")}
              className="text-xs font-semibold text-white/70 hover:text-white"
            >
              Skip
            </button>
          </header>

          <div className="relative mt-6 px-5">
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
              >
                <PhoneFrame>{slide.mock}</PhoneFrame>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ---- copy section ---- */}
        <div className="relative flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-md px-7 pt-4">
            <div className="flex items-center gap-2">
              <Icon size={14} className="text-primary" />
              <span className="kicker text-primary">{slide.kicker}</span>
            </div>
            <h1 className="mt-2 whitespace-pre-line font-display text-[1.9rem] font-bold leading-[1.08] tracking-tight text-foreground">
              {slide.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{slide.body}</p>
          </div>

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
