import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/move-money" element={<MoveMoney />} />
          <Route path="/move-money/:action" element={<MoveMoney />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/personal" element={<PersonalInfo />} />
          <Route path="/profile/documents" element={<Documents />} />
          <Route path="/profile/address" element={<PersonalInfo />} />
          <Route path="/profile/identity" element={<PersonalInfo />} />
          <Route path="/profile/employment" element={<PersonalInfo />} />
          <Route path="/profile/linked" element={<PersonalInfo />} />
          <Route path="/transaction/:id" element={<TransactionDetail />} />
          <Route path="/account/:type" element={<AccountDetail />} />
          <Route path="/security" element={<SecurityCenter />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/notifications/settings" element={<Notifications />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/help/contact" element={<HelpCenter />} />
          <Route path="/insights" element={<SpendingInsights />} />
          <Route path="/settings" element={<SecurityCenter />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
