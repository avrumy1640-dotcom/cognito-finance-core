import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "compliance" | "support" | "user";

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[] | null>(null);

  useEffect(() => {
    if (!user) { setRoles([]); return; }
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles((data ?? []).map((r) => r.role as AppRole));
    })();
  }, [user]);

  return {
    roles,
    loading: roles === null,
    isAdmin: !!roles?.includes("admin"),
    isSupport: !!roles?.includes("support"),
    isCompliance: !!roles?.includes("compliance"),
    hasStaffAccess: !!roles?.some((r) => r === "admin" || r === "support" || r === "compliance"),
  };
}
