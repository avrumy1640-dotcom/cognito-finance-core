import { useProfile } from "@/hooks/useProfile";

/**
 * Whether the signed-in customer opened a BUSINESS account.
 *
 * `profiles.account_type` is set once during onboarding and is the single
 * source of truth for which product experience to render. Personal customers
 * must never see any of the business surfaces.
 */
export const useBusiness = () => {
  const { profile, loading } = useProfile();
  const isBusiness = (profile?.account_type ?? "").toLowerCase() === "business";
  return {
    loading,
    isBusiness,
    businessName: profile?.business_name?.trim() || "Your business",
  };
};
