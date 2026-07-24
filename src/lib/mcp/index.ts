import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfile from "./tools/get-profile";
import getKycStatus from "./tools/get-kyc-status";
import listBeneficiaries from "./tools/list-beneficiaries";
import listPaymentRequests from "./tools/list-payment-requests";
import createPaymentRequest from "./tools/create-payment-request";
import listScheduledTransfers from "./tools/list-scheduled-transfers";
import listSupportTickets from "./tools/list-support-tickets";
import createSupportTicket from "./tools/create-support-ticket";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "glass-bank-mcp",
  title: "Glass Bank",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in Glass Bank user: read profile and KYC status, list beneficiaries, list and create payment requests, list scheduled transfers, and manage support tickets. All actions run as the authenticated user with the same permissions as the app.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getProfile,
    getKycStatus,
    listBeneficiaries,
    listPaymentRequests,
    createPaymentRequest,
    listScheduledTransfers,
    listSupportTickets,
    createSupportTicket,
  ],
});
