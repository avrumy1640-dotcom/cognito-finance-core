
-- Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- trusted_devices: replace ALL policy with explicit per-action policies
DROP POLICY IF EXISTS "Users manage own trusted devices" ON public.trusted_devices;

CREATE POLICY "Users view own trusted devices"
  ON public.trusted_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users add own trusted devices"
  ON public.trusted_devices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own trusted devices"
  ON public.trusted_devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own trusted devices"
  ON public.trusted_devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- webhook_events: explicit service_role write policies
CREATE POLICY "Service role inserts webhook events"
  ON public.webhook_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates webhook events"
  ON public.webhook_events FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
