-- 1. SECURITY DEFINER function should not be callable by signed-in users directly
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, app_role, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, app_role, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, app_role, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean) TO service_role;

-- 2. scheduled_transfer_runs: explicit deny of writes for app users
REVOKE INSERT, UPDATE, DELETE ON public.scheduled_transfer_runs FROM authenticated;
REVOKE ALL ON public.scheduled_transfer_runs FROM anon;
GRANT SELECT ON public.scheduled_transfer_runs TO authenticated;
GRANT ALL ON public.scheduled_transfer_runs TO service_role;

DROP POLICY IF EXISTS "No user inserts on schedule runs" ON public.scheduled_transfer_runs;
DROP POLICY IF EXISTS "No user updates on schedule runs" ON public.scheduled_transfer_runs;
DROP POLICY IF EXISTS "No user deletes on schedule runs" ON public.scheduled_transfer_runs;

CREATE POLICY "No user inserts on schedule runs"
  ON public.scheduled_transfer_runs FOR INSERT TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "No user updates on schedule runs"
  ON public.scheduled_transfer_runs FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "No user deletes on schedule runs"
  ON public.scheduled_transfer_runs FOR DELETE TO authenticated, anon
  USING (false);

-- 3. transaction_category_rules: scope reads to active rules for normal users
DROP POLICY IF EXISTS "Authenticated read category rules" ON public.transaction_category_rules;
CREATE POLICY "Authenticated read active category rules"
  ON public.transaction_category_rules FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));
REVOKE ALL ON public.transaction_category_rules FROM anon;