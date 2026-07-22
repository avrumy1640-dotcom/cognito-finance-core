import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useRoles, AppRole } from "@/hooks/useRole";

interface Props {
  children: ReactNode;
  allow?: AppRole[];
}

const RequireAdmin = ({ children, allow = ["admin"] }: Props) => {
  const { roles, loading } = useRoles();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  const allowed = roles?.some((r) => allow.includes(r));
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default RequireAdmin;
