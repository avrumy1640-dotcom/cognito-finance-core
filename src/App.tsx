import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BankProvider } from "@/store/bankStore";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MoveMoney from "./pages/MoveMoney";
import Cards from "./pages/Cards";
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
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import VerifyIdentity from "./pages/VerifyIdentity";
import Welcome from "./pages/Welcome";
import VerifyEmail from "./pages/VerifyEmail";
import MfaChallenge from "./pages/MfaChallenge";
import Onboarding from "./pages/Onboarding";
import ReceiveMoney from "./pages/ReceiveMoney";

const queryClient = new QueryClient();

const Guarded = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BankProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login initialMode="signin" />} />
              <Route path="/signup" element={<Login initialMode="signup" />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/mfa-challenge" element={<MfaChallenge />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Guarded><Onboarding /></Guarded>} />
              <Route path="/" element={<Guarded><Index /></Guarded>} />
              <Route path="/receive" element={<Guarded><ReceiveMoney /></Guarded>} />
              <Route path="/move-money" element={<Guarded><MoveMoney /></Guarded>} />
              <Route path="/move-money/:action" element={<Guarded><MoveMoney /></Guarded>} />
              <Route path="/cards" element={<Guarded><Cards /></Guarded>} />
              <Route path="/activity" element={<Guarded><Activity /></Guarded>} />
              <Route path="/profile" element={<Guarded><Profile /></Guarded>} />
              <Route path="/profile/personal" element={<Guarded><PersonalInfo /></Guarded>} />
              <Route path="/profile/verify" element={<Guarded><VerifyIdentity /></Guarded>} />
              <Route path="/profile/documents" element={<Guarded><Documents /></Guarded>} />
              <Route path="/profile/address" element={<Guarded><PersonalInfo /></Guarded>} />
              <Route path="/profile/identity" element={<Guarded><PersonalInfo /></Guarded>} />
              <Route path="/profile/employment" element={<Guarded><PersonalInfo /></Guarded>} />
              <Route path="/profile/linked" element={<Guarded><PersonalInfo /></Guarded>} />
              <Route path="/transaction/:id" element={<Guarded><TransactionDetail /></Guarded>} />
              <Route path="/account/:type" element={<Guarded><AccountDetail /></Guarded>} />
              <Route path="/security" element={<Guarded><SecurityCenter /></Guarded>} />
              <Route path="/notifications" element={<Guarded><Notifications /></Guarded>} />
              <Route path="/notifications/settings" element={<Guarded><Notifications /></Guarded>} />
              <Route path="/help" element={<Guarded><HelpCenter /></Guarded>} />
              <Route path="/help/contact" element={<Guarded><HelpCenter /></Guarded>} />
              <Route path="/insights" element={<Guarded><SpendingInsights /></Guarded>} />
              <Route path="/settings" element={<Guarded><SecurityCenter /></Guarded>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </BankProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
