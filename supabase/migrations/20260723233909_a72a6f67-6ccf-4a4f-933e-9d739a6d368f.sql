
-- 1. has_role: switch to SECURITY INVOKER (users can read their own roles via RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- 2. audit_logs: restrict INSERT to admins (service_role bypasses RLS)
DROP POLICY IF EXISTS "Authenticated insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. fee_config: restrict SELECT to admins only
DROP POLICY IF EXISTS "All read fees" ON public.fee_config;
CREATE POLICY "Admins read fees"
  ON public.fee_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. scheduled_transfers: scope policy to authenticated role
DROP POLICY IF EXISTS "Users manage their scheduled transfers" ON public.scheduled_transfers;
CREATE POLICY "Users manage their scheduled transfers"
  ON public.scheduled_transfers
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
