import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BankProvider } from "@/store/bankStore";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLock from "@/components/AppLock";
import AppShell from "@/components/layout/AppShell";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MoveMoney from "./pages/MoveMoney";
import Cards from "./pages/Cards";
import ReplaceCard from "./pages/cards/ReplaceCard";
import ReportCard from "./pages/cards/ReportCard";
import ChangePin from "./pages/cards/ChangePin";
import TravelNotice from "./pages/cards/TravelNotice";
import VirtualCard from "./pages/cards/VirtualCard";
import Activity from "./pages/Activity";
import Profile from "./pages/Profile";
import TransactionDetail from "./pages/TransactionDetail";
import AccountDetail from "./pages/AccountDetail";
import SecurityCenter from "./pages/SecurityCenter";
import Notifications from "./pages/Notifications";
import HelpCenter from "./pages/HelpCenter";
import PersonalInfo from "./pages/PersonalInfo";
import Documents from "./pages/Documents";
import SpendingInsights from "./pages/SpendingInsights";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import VerifyIdentity from "./pages/VerifyIdentity";
import Welcome from "./pages/Welcome";
import Intro from "./pages/Intro";
import VerifyEmail from "./pages/VerifyEmail";
import MfaChallenge from "./pages/MfaChallenge";
import OAuthConsent from "./pages/OAuthConsent";
import Onboarding from "./pages/Onboarding";
import ReceiveMoney from "./pages/ReceiveMoney";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import SupportTicket from "./pages/SupportTicket";
import Beneficiaries from "./pages/Beneficiaries";
import JointAccounts from "./pages/JointAccounts";
import PaymentRequests from "./pages/PaymentRequests";
import ScheduledTransfers from "./pages/ScheduledTransfers";
import DirectDeposit from "./pages/DirectDeposit";
import Goals from "./pages/Goals";
import EarlyPay from "./pages/EarlyPay";
import Disputes from "./pages/Disputes";
import Referrals from "./pages/Referrals";
import Rewards from "./pages/Rewards";
import Credit from "./pages/Credit";
import RequireAdmin from "./components/RequireAdmin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminProvider from "./pages/admin/AdminProvider";
import EarlyDirectDepositGuide from "./pages/blog/EarlyDirectDepositGuide";
import RouteSeo from "@/components/RouteSeo";
import BusinessHome from "./pages/business/BusinessHome";
import BusinessPayments from "./pages/business/Payments";
import Invoices from "./pages/business/Invoices";
import Team from "./pages/business/Team";
import Reimbursements from "./pages/business/Reimbursements";
import Bills from "./pages/business/Bills";
import Approvals from "./pages/business/Approvals";
import Bookkeeping from "./pages/business/Bookkeeping";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import PrivacyCenter from "./pages/PrivacyCenter";

const queryClient = new QueryClient();

// Bare guard — used by full-screen flows (onboarding, KYC) that must not
// show app navigation.
const Bare = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);
const Guarded = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);
// Banking-grade guard: signed-in + onboarded + KYC verified. Anything that
// exposes balances, transactions, cards, or money movement must use this.
const Banking = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireKyc>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BankProvider>
          <Toaster />
          <Sonner />
          <AppLock />
          <BrowserRouter>
            <RouteSeo />
            <Routes>
              <Route path="/intro" element={<Intro />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/blog/early-direct-deposit-guide" element={<EarlyDirectDepositGuide />} />
              {/* Legal pages stay public — they must be readable before sign-up. */}
              <Route path="/legal/privacy" element={<Privacy />} />
              <Route path="/legal/terms" element={<Terms />} />
              <Route path="/login" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/mfa-challenge" element={<MfaChallenge />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/onboarding" element={<Bare><Onboarding /></Bare>} />
              <Route path="/" element={<Banking><Index /></Banking>} />
              <Route path="/receive" element={<Banking><ReceiveMoney /></Banking>} />
              <Route path="/move-money" element={<Banking><MoveMoney /></Banking>} />
              <Route path="/move-money/:action" element={<Banking><MoveMoney /></Banking>} />
              <Route path="/cards" element={<Banking><Cards /></Banking>} />
              <Route path="/cards/replace" element={<Banking><ReplaceCard /></Banking>} />
              <Route path="/cards/report" element={<Banking><ReportCard /></Banking>} />
              <Route path="/cards/pin" element={<Banking><ChangePin /></Banking>} />
              <Route path="/cards/travel" element={<Banking><TravelNotice /></Banking>} />
              <Route path="/cards/virtual" element={<Banking><VirtualCard /></Banking>} />
              <Route path="/activity" element={<Banking><Activity /></Banking>} />
              <Route path="/profile" element={<Guarded><Profile /></Guarded>} />
              <Route path="/profile/personal" element={<Guarded><PersonalInfo /></Guarded>} />
              <Route path="/profile/verify" element={<Bare><VerifyIdentity /></Bare>} />
              

              <Route path="/profile/documents" element={<Guarded><Documents /></Guarded>} />
              {/* Redundant /profile/address, /identity, /employment, /linked
                  routes were removed — they all rendered PersonalInfo and
                  confused the menu. PersonalInfo now owns all editable
                  fields; Identity data is under /profile/verify. */}

              <Route path="/transaction/:id" element={<Banking><TransactionDetail /></Banking>} />
              <Route path="/account/:type" element={<Banking><AccountDetail /></Banking>} />
              <Route path="/security" element={<Guarded><SecurityCenter /></Guarded>} />
              <Route path="/notifications" element={<Guarded><Notifications /></Guarded>} />
              <Route path="/notifications/settings" element={<Guarded><Notifications /></Guarded>} />
              <Route path="/help" element={<Guarded><HelpCenter /></Guarded>} />
              <Route path="/help/contact" element={<Guarded><HelpCenter /></Guarded>} />
              <Route path="/insights" element={<Banking><SpendingInsights /></Banking>} />
              <Route path="/settings" element={<Guarded><Settings /></Guarded>} />
              <Route path="/support" element={<Guarded><Support /></Guarded>} />
              <Route path="/support/:id" element={<Guarded><SupportTicket /></Guarded>} />
              <Route path="/privacy-center" element={<Guarded><PrivacyCenter /></Guarded>} />
              <Route path="/joint-accounts" element={<Banking><JointAccounts /></Banking>} />
              <Route path="/beneficiaries" element={<Banking><Beneficiaries /></Banking>} />
              <Route path="/payment-requests" element={<Banking><PaymentRequests /></Banking>} />
              <Route path="/direct-deposit" element={<Banking><DirectDeposit /></Banking>} />
              <Route path="/goals" element={<Banking><Goals /></Banking>} />
              <Route path="/early-pay" element={<Banking><EarlyPay /></Banking>} />
              <Route path="/disputes" element={<Banking><Disputes /></Banking>} />
              <Route path="/referrals" element={<Banking><Referrals /></Banking>} />
              <Route path="/rewards" element={<Banking><Rewards /></Banking>} />
              <Route path="/credit" element={<Banking><Credit /></Banking>} />
              <Route path="/business" element={<Banking><BusinessHome /></Banking>} />
              <Route path="/payments" element={<Banking><BusinessPayments /></Banking>} />
              <Route path="/invoices" element={<Banking><Invoices /></Banking>} />
              <Route path="/team" element={<Banking><Team /></Banking>} />
              <Route path="/reimbursements" element={<Banking><Reimbursements /></Banking>} />
              <Route path="/bills" element={<Banking><Bills /></Banking>} />
              <Route path="/approvals" element={<Banking><Approvals /></Banking>} />
              <Route path="/bookkeeping" element={<Banking><Bookkeeping /></Banking>} />
              <Route path="/scheduled" element={<Banking><ScheduledTransfers /></Banking>} />
              <Route path="/admin" element={<Guarded><RequireAdmin><AdminLayout /></RequireAdmin></Guarded>}>
                <Route index element={<AdminProvider />} />
                <Route path="provider" element={<AdminProvider />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </BankProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
