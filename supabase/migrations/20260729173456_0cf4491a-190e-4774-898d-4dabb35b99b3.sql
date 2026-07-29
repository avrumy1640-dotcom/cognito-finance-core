CREATE TABLE public.column_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id text NOT NULL UNIQUE,
  entity_type text NOT NULL DEFAULT 'person',
  verification_status text NOT NULL DEFAULT 'unverified',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.column_entities TO authenticated;
GRANT ALL ON public.column_entities TO service_role;
ALTER TABLE public.column_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own column entity" ON public.column_entities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all column entities" ON public.column_entities FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.column_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id text NOT NULL,
  bank_account_id text NOT NULL UNIQUE,
  account_number_id text,
  account_number_masked text,
  routing_number text,
  description text,
  account_type text NOT NULL DEFAULT 'checking',
  status text NOT NULL DEFAULT 'open',
  is_overdrawn boolean NOT NULL DEFAULT false,
  balances jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.column_bank_accounts TO authenticated;
GRANT ALL ON public.column_bank_accounts TO service_role;
ALTER TABLE public.column_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own column accounts" ON public.column_bank_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all column accounts" ON public.column_bank_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.column_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  transfer_id text NOT NULL UNIQUE,
  transfer_type text NOT NULL DEFAULT 'ach',
  bank_account_id text,
  status text NOT NULL DEFAULT 'pending',
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  direction text NOT NULL DEFAULT 'credit',
  description text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.column_transfers TO authenticated;
GRANT ALL ON public.column_transfers TO service_role;
ALTER TABLE public.column_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own column transfers" ON public.column_transfers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all column transfers" ON public.column_transfers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_column_accounts_user ON public.column_bank_accounts(user_id);
CREATE INDEX idx_column_transfers_user ON public.column_transfers(user_id);
CREATE INDEX idx_column_transfers_account ON public.column_transfers(bank_account_id);

CREATE TRIGGER trg_column_entities_updated BEFORE UPDATE ON public.column_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_column_accounts_updated BEFORE UPDATE ON public.column_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_column_transfers_updated BEFORE UPDATE ON public.column_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();