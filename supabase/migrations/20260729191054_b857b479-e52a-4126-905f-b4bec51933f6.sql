CREATE TABLE IF NOT EXISTS public.column_counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counterparty_id text NOT NULL UNIQUE,
  name text,
  routing_number text NOT NULL,
  account_number_last4 text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.column_counterparties TO service_role;

ALTER TABLE public.column_counterparties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to counterparties"
  ON public.column_counterparties FOR ALL
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_column_counterparties_user
  ON public.column_counterparties (user_id, routing_number, account_number_last4);

CREATE TRIGGER update_column_counterparties_updated_at
  BEFORE UPDATE ON public.column_counterparties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.column_bank_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.column_transfers REPLICA IDENTITY FULL;
ALTER TABLE public.column_entities REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.column_bank_accounts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.column_transfers;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.column_entities;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;