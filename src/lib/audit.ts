import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side security events that belong in the audit trail.
 *
 * The browser cannot be trusted to say *who* it is, so the edge function
 * derives the actor from the verified JWT and ignores anything we send about
 * identity. Failures are logged, never thrown into a user flow.
 */
export type AuditEvent =
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.mfa_challenge_passed"
  | "auth.mfa_enrolled"
  | "auth.password_changed"
  | "auth.passcode_changed"
  | "auth.device_trusted"
  | "auth.device_removed"
  | "privacy.policy_viewed";

export async function recordAuditEvent(
  event: AuditEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("audit-log", {
      body: { event, metadata },
    });
    if (error) console.warn(`audit event "${event}" not recorded:`, error.message);
  } catch (e) {
    console.warn(`audit event "${event}" not recorded:`, (e as Error).message);
  }
}
