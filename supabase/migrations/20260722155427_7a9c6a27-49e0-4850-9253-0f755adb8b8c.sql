
-- === Roles ===
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','compliance','support','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- === Admin-visible policies added to existing tables ===
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support') OR public.has_role(auth.uid(), 'compliance'));

CREATE POLICY "Admins read all kyc" ON public.kyc_profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance'));
CREATE POLICY "Compliance updates kyc" ON public.kyc_profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance'));

CREATE POLICY "Admins read all tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));
CREATE POLICY "Admins update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "Admins read all ticket messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));
CREATE POLICY "Admins insert ticket messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'))
    AND author = 'agent' AND auth.uid() = user_id
  );

-- === Audit logs ===
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at DESC);

-- === Webhook events ===
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webhooks" ON public.webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS webhook_events_received_idx ON public.webhook_events(received_at DESC);

-- === Fee config ===
CREATE TABLE IF NOT EXISTS public.fee_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  percent_bps integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fee_config TO authenticated;
GRANT ALL ON public.fee_config TO service_role;
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All read fees" ON public.fee_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage fees" ON public.fee_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default fees
INSERT INTO public.fee_config (key, label, amount_cents, percent_bps, currency) VALUES
  ('ach_out', 'ACH transfer (outbound)', 0, 0, 'USD'),
  ('wire_domestic', 'Domestic wire', 1500, 0, 'USD'),
  ('wire_international', 'International wire', 3500, 0, 'USD'),
  ('card_replacement', 'Card replacement', 500, 0, 'USD'),
  ('exchange_spread', 'FX exchange', 0, 50, 'USD')
ON CONFLICT (key) DO NOTHING;

-- === Beneficiaries ===
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  full_name text NOT NULL,
  kind text NOT NULL DEFAULT 'ach', -- ach, wire, internal, crypto
  bank_name text,
  routing_number text,
  account_number_last4 text,
  swift_bic text,
  iban text,
  country text,
  address text,
  email text,
  memo text,
  favorite boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO authenticated;
GRANT ALL ON public.beneficiaries TO service_role;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own beneficiaries" ON public.beneficiaries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS beneficiaries_updated_at ON public.beneficiaries;
CREATE TRIGGER beneficiaries_updated_at BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS beneficiaries_user_idx ON public.beneficiaries(user_id, favorite DESC, updated_at DESC);

-- === Payment requests ===
DO $$ BEGIN
  CREATE TYPE public.payment_request_status AS ENUM ('pending','paid','declined','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL, -- who is asking for money
  payer_id uuid,              -- optional in-app payer
  payer_email text,           -- otherwise contact via email
  payer_name text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  note text,
  status public.payment_request_status NOT NULL DEFAULT 'pending',
  paid_transaction_id text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read requests they sent or received" ON public.payment_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = payer_id);
CREATE POLICY "Users create outgoing requests" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Requester or payer updates request" ON public.payment_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = payer_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = payer_id);
DROP TRIGGER IF EXISTS payment_requests_updated_at ON public.payment_requests;
CREATE TRIGGER payment_requests_updated_at BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS payment_requests_requester_idx ON public.payment_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_requests_payer_idx ON public.payment_requests(payer_id, created_at DESC);
