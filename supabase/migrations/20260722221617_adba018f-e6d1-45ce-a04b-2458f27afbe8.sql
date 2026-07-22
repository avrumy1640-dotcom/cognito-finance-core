
CREATE TABLE public.scheduled_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('internal','external','wire','bill','send')),
  from_account TEXT NOT NULL,
  to_label TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  memo TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  frequency TEXT NOT NULL DEFAULT 'once' CHECK (frequency IN ('once','weekly','biweekly','monthly')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','processing','completed','failed','cancelled')),
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_transfers TO authenticated;
GRANT ALL ON public.scheduled_transfers TO service_role;

ALTER TABLE public.scheduled_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their scheduled transfers"
  ON public.scheduled_transfers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER scheduled_transfers_updated_at
  BEFORE UPDATE ON public.scheduled_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX scheduled_transfers_user_status_idx ON public.scheduled_transfers(user_id, status, scheduled_for);
