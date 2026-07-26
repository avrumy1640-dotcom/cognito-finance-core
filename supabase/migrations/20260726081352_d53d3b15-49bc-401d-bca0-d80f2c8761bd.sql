-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role writes notifications" ON public.notifications
  FOR INSERT TO service_role WITH CHECK (true);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_dedupe_idx ON public.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ============ NOTIFICATION PREFERENCES ============
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  push_deposits boolean NOT NULL DEFAULT true,
  push_card boolean NOT NULL DEFAULT true,
  push_transfers boolean NOT NULL DEFAULT true,
  push_low_balance boolean NOT NULL DEFAULT true,
  push_security boolean NOT NULL DEFAULT true,
  email_statements boolean NOT NULL DEFAULT true,
  email_marketing boolean NOT NULL DEFAULT false,
  large_txn_amount integer NOT NULL DEFAULT 500,
  low_balance_amount integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification prefs" ON public.notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRANSACTION CATEGORY RULES ============
CREATE TABLE public.transaction_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  category text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transaction_category_rules TO authenticated;
GRANT ALL ON public.transaction_category_rules TO service_role;
ALTER TABLE public.transaction_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read category rules" ON public.transaction_category_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage category rules" ON public.transaction_category_rules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER transaction_category_rules_updated_at BEFORE UPDATE ON public.transaction_category_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.transaction_category_rules (pattern, category, priority) VALUES
  ('whole foods|trader joe|safeway|kroger|aldi|lidl|tesco|sainsbury|publix|wegmans|costco|grocer|supermarket|food market|instacart', 'Groceries', 10),
  ('starbucks|dunkin|blue bottle|mcdonald|burger|pizza|chipotle|sweetgreen|restaurant|cafe|coffee|bistro|doordash|ubereats|uber eats|grubhub|deliveroo|bar & grill', 'Dining', 10),
  ('uber|lyft|bolt|taxi|cab|transit|metro|subway rail|amtrak|shell|chevron|exxon|bp fuel|petrol|gas station|parking|toll', 'Transport', 10),
  ('amazon|ebay|walmart|target|best buy|etsy|shein|zara|h&m|nike|adidas|apple store|shop|store', 'Shopping', 30),
  ('electric|utility|utilities|water co|comcast|xfinity|verizon|at&t|t-mobile|vodafone|internet|broadband|phone bill|pg&e|con ed|energy', 'Bills & Utilities', 10),
  ('rent|landlord|mortgage|hoa|property mgmt|leasing', 'Housing', 10),
  ('pharmacy|cvs|walgreens|clinic|hospital|dental|dentist|doctor|medical|health|insurance premium', 'Health', 10),
  ('netflix|spotify|hulu|disney|hbo|max stream|youtube|prime video|playstation|xbox|steam|twitch|cinema|movie|concert|ticketmaster', 'Entertainment', 10),
  ('airline|airways|flight|hotel|booking\.com|airbnb|expedia|marriott|hilton|delta air|united air|ryanair|easyjet|travel', 'Travel', 10),
  ('payroll|salary|direct deposit|paycheck|employer|interest payment|dividend|refund|reimburs', 'Income', 5),
  ('transfer|zelle|venmo|cash app|paypal|wire|ach|sepa|swift|internal', 'Transfers', 40),
  ('fee|charge|commission|service charge|overdraft|atm fee|maintenance fee', 'Fees', 5);

-- ============ TRANSACTION CATEGORIES ============
CREATE TABLE public.transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_ref text NOT NULL,
  category text NOT NULL,
  merchant_normalized text,
  is_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, transaction_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_categories TO authenticated;
GRANT ALL ON public.transaction_categories TO service_role;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transaction categories" ON public.transaction_categories
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER transaction_categories_updated_at BEFORE UPDATE ON public.transaction_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WEBAUTHN CREDENTIALS ============
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text,
  transports text[],
  label text NOT NULL DEFAULT 'This device',
  device_id text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own webauthn credentials" ON public.webauthn_credentials
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ USER SECURITY SETTINGS ============
CREATE TABLE public.user_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  biometric_enabled boolean NOT NULL DEFAULT false,
  passcode_hash text,
  passcode_salt text,
  passcode_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_security_settings TO authenticated;
GRANT ALL ON public.user_security_settings TO service_role;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own security settings" ON public.user_security_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_security_settings_updated_at BEFORE UPDATE ON public.user_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SCHEDULED TRANSFER EXECUTION ============
ALTER TABLE public.scheduled_transfers
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_attention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_transaction_ref text;

CREATE TABLE public.scheduled_transfer_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.scheduled_transfers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  occurrence_key text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  transaction_ref text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (schedule_id, occurrence_key)
);
GRANT SELECT ON public.scheduled_transfer_runs TO authenticated;
GRANT ALL ON public.scheduled_transfer_runs TO service_role;
ALTER TABLE public.scheduled_transfer_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own schedule runs" ON public.scheduled_transfer_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages schedule runs" ON public.scheduled_transfer_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ RBAC BOOTSTRAP + SERVER-SIDE ROLE CHANGES ============
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role FROM auth.users u
WHERE lower(u.email) = 'avrumy@hfarealty.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role app_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_admin boolean;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _caller AND role = 'admin'::app_role)
    INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Only administrators can change roles';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF _user_id = _caller AND _role = 'admin'::app_role THEN
      RAISE EXCEPTION 'You cannot remove your own admin role';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_caller, CASE WHEN _grant THEN 'role.grant' ELSE 'role.revoke' END, 'user', _user_id::text,
          jsonb_build_object('role', _role));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean) TO authenticated;

-- ============ REALTIME ============
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_transfers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_transfers;