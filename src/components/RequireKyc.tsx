import { ReactNode } from "react";
import { useKyc } from "@/hooks/useKyc";
import KycStatusCard from "@/components/kyc/KycStatusCard";

interface Props {
  children?: ReactNode;
  /** Message shown above the CTA when unverified. */
  reason?: string;
}

/**
 * Blocks children until the user's KYC profile is verified.
 * Delegates to the unified KycStatusCard so timing/messaging stays consistent
 * across every screen that gates on identity.
 */
const RequireKyc = ({ children, reason = "Verify your identity to move money" }: Props) => {
  const { status, loading, profile, refresh } = useKyc();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === "verified") return <>{children}</>;

  return (
    <div className="px-5 pt-14 space-y-4">
      <KycStatusCard
        status={status}
        profile={profile}
        reason={reason}
        onRetry={refresh}
        refreshing={loading}
      />
    </div>
  );
};

export default RequireKyc;
