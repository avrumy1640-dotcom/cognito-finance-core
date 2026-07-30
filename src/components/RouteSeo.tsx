import { useLocation } from "react-router-dom";
import Seo from "@/components/Seo";

type Meta = { title: string; description: string };

/**
 * Fallback per-route head tags. Routes whose page component renders its own
 * <Seo> are deliberately absent from this map so we never write the head twice.
 */
const ROUTE_SEO: Record<string, Meta> = {
  "/receive": {
    title: "Receive Money — Glass Bank",
    description: "Share your Glass Bank account and routing details, request money, and track incoming transfers as they settle.",
  },
  "/move-money": {
    title: "Move Money — Glass Bank",
    description: "Send money by internal transfer, ACH or wire, pay bills, and see the exact speed and fee before you confirm.",
  },
  "/cards": {
    title: "Your Cards — Glass Bank",
    description: "Manage your Glass Bank physical and virtual cards: freeze, replace, set a PIN, add travel notices and review card spending.",
  },
  "/cards/replace": {
    title: "Replace a Card — Glass Bank",
    description: "Order a replacement Glass Bank card when yours is lost, damaged or worn, and track it until it arrives.",
  },
  "/cards/report": {
    title: "Report a Card — Glass Bank",
    description: "Report a lost, stolen or compromised Glass Bank card, freeze it instantly and request a secure replacement.",
  },
  "/cards/pin": {
    title: "Change Card PIN — Glass Bank",
    description: "Set or change the PIN on your Glass Bank card securely from inside the app, without calling support.",
  },
  "/cards/travel": {
    title: "Travel Notice — Glass Bank",
    description: "Tell Glass Bank where you're travelling so your card keeps working abroad without triggering fraud blocks.",
  },
  "/cards/virtual": {
    title: "Virtual Cards — Glass Bank",
    description: "Create single-use and subscription virtual cards with their own limits to keep your real card number private.",
  },
  "/activity": {
    title: "Activity & Transactions — Glass Bank",
    description: "Search, filter and export every Glass Bank transaction, with live status for pending, settled and returned transfers.",
  },
  "/profile": {
    title: "Your Profile — Glass Bank",
    description: "Review your Glass Bank profile, identity verification status, documents and personal details in one place.",
  },
  "/profile/personal": {
    title: "Personal Information — Glass Bank",
    description: "View and update the personal information on file for your Glass Bank account, including address and contact details.",
  },
  "/profile/documents": {
    title: "Documents & Statements — Glass Bank",
    description: "Download Glass Bank statements, tax forms and verification documents whenever you need them.",
  },
  "/security": {
    title: "Security Center — Glass Bank",
    description: "Turn on two-factor authentication, biometric unlock and an app passcode, and review recent Glass Bank sign-in activity.",
  },
  "/notifications": {
    title: "Notifications — Glass Bank",
    description: "See Glass Bank alerts for deposits, card activity and security events, and choose exactly which ones you receive.",
  },
  "/help": {
    title: "Help Center — Glass Bank",
    description: "Answers to common Glass Bank questions about accounts, verification, transfers, cards, security and disputes.",
  },
  "/insights": {
    title: "Spending Insights — Glass Bank",
    description: "See where your money goes each month with Glass Bank category breakdowns, trends and merchant-level detail.",
  },
  "/settings": {
    title: "Settings — Glass Bank",
    description: "Control your Glass Bank appearance, language, currency, privacy and notification preferences from one screen.",
  },
  "/support": {
    title: "Support — Glass Bank",
    description: "Open a Glass Bank support ticket, track its status and message our team about anything on your account.",
  },
  "/beneficiaries": {
    title: "Beneficiaries — Glass Bank",
    description: "Save and manage the people and businesses you pay, so repeat Glass Bank transfers take just a couple of taps.",
  },
  "/payment-requests": {
    title: "Payment Requests — Glass Bank",
    description: "Request money from other Glass Bank customers and track which requests are pending, paid or declined.",
  },
  "/direct-deposit": {
    title: "Direct Deposit — Glass Bank",
    description: "Get your routing and account numbers and a prefilled form to switch your payroll direct deposit to Glass Bank.",
  },
  "/goals": {
    title: "Savings Goals — Glass Bank",
    description: "Create Glass Bank savings goals, automate contributions and watch each target fill up as you save.",
  },
  "/early-pay": {
    title: "Early Pay — Glass Bank",
    description: "Get your paycheck up to two days early with Glass Bank Early Pay, at no extra cost once direct deposit is set up.",
  },
  "/disputes": {
    title: "Dispute a Transaction — Glass Bank",
    description: "Raise a dispute on a Glass Bank card transaction, upload evidence and follow the case through to resolution.",
  },
  "/referrals": {
    title: "Refer a Friend — Glass Bank",
    description: "Share your Glass Bank referral link and earn a bonus when a friend opens and funds their account.",
  },
  "/rewards": {
    title: "Rewards & Cashback — Glass Bank",
    description: "Track the cashback you've earned on Glass Bank card spending and see which offers are active right now.",
  },
  "/credit": {
    title: "Credit Building — Glass Bank",
    description: "Build credit history with Glass Bank, monitor your score and understand what is moving it each month.",
  },
  "/scheduled": {
    title: "Scheduled Transfers — Glass Bank",
    description: "Review, edit and cancel your upcoming and recurring Glass Bank transfers before they run.",
  },
  "/onboarding": {
    title: "Open Your Account — Glass Bank",
    description: "Complete Glass Bank onboarding: confirm your details, verify your identity and open your account in minutes.",
  },
  "/verify-email": {
    title: "Verify Your Email — Glass Bank",
    description: "Confirm your email address to finish securing your Glass Bank account and continue signing in.",
  },
  "/mfa-challenge": {
    title: "Two-Factor Verification — Glass Bank",
    description: "Enter the code from your authenticator app to complete two-factor verification for your Glass Bank account.",
  },
  "/reset-password": {
    title: "Reset Your Password — Glass Bank",
    description: "Set a new password for your Glass Bank account using the secure reset link we emailed you.",
  },
};

/** Private, session-only surfaces that should never be indexed. */
const NOINDEX = new Set([
  "/verify-email",
  "/mfa-challenge",
  "/reset-password",
  "/onboarding",
  "/notifications",
  "/settings",
  "/profile",
  "/profile/personal",
  "/profile/documents",
  "/security",
  "/support",
]);

const RouteSeo = () => {
  const { pathname } = useLocation();
  const meta = ROUTE_SEO[pathname];
  if (!meta) return null;
  return <Seo title={meta.title} description={meta.description} path={pathname} noindex={NOINDEX.has(pathname)} />;
};

export default RouteSeo;
