-- Primary-owner helper
CREATE OR REPLACE FUNCTION private.user_is_primary_owner(_user_id uuid, _bank_account_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_owners
    WHERE user_id = _user_id AND bank_account_id = _bank_account_id AND role = 'primary'
  );
$$;
REVOKE ALL ON FUNCTION private.user_is_primary_owner(uuid, text) FROM PUBLIC, anon, authenticated;

-- 1. Bills to pay (AP)
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_account_id text NOT NULL,
  vendor_name text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  due_date date,
  status text NOT NULL DEFAULT 'unpaid',
  memo text,
  transfer_id text,
  scheduled_transfer_id uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account managers read bills" ON public.bills FOR SELECT TO authenticated
  USING (private.user_owns_bank_account(auth.uid(), bank_account_id));
CREATE POLICY "Account managers create bills" ON public.bills FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.user_can_manage_account(auth.uid(), bank_account_id));
CREATE POLICY "Account managers update bills" ON public.bills FOR UPDATE TO authenticated
  USING (private.user_can_manage_account(auth.uid(), bank_account_id))
  WITH CHECK (private.user_can_manage_account(auth.uid(), bank_account_id));
CREATE POLICY "Account managers delete bills" ON public.bills FOR DELETE TO authenticated
  USING (private.user_can_manage_account(auth.uid(), bank_account_id));
CREATE TRIGGER bills_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX bills_account_status_idx ON public.bills (bank_account_id, status, due_date);

-- 2. Per-account controls
CREATE TABLE public.account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id text NOT NULL UNIQUE,
  approval_threshold_cents bigint,
  receipt_required_cents bigint NOT NULL DEFAULT 7500,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.account_settings TO authenticated;
GRANT ALL ON public.account_settings TO service_role;
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read account settings" ON public.account_settings FOR SELECT TO authenticated
  USING (private.user_owns_bank_account(auth.uid(), bank_account_id));
CREATE POLICY "Primary owner creates account settings" ON public.account_settings FOR INSERT TO authenticated
  WITH CHECK (private.user_is_primary_owner(auth.uid(), bank_account_id));
CREATE POLICY "Primary owner updates account settings" ON public.account_settings FOR UPDATE TO authenticated
  USING (private.user_is_primary_owner(auth.uid(), bank_account_id))
  WITH CHECK (private.user_is_primary_owner(auth.uid(), bank_account_id));
CREATE TRIGGER account_settings_updated_at BEFORE UPDATE ON public.account_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Payment approvals
CREATE TABLE public.payment_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id text NOT NULL,
  requested_by uuid NOT NULL,
  kind text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_approval',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  transfer_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_approvals TO authenticated;
GRANT ALL ON public.payment_approvals TO service_role;
ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read approvals" ON public.payment_approvals FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR private.user_can_manage_account(auth.uid(), bank_account_id));
CREATE TRIGGER payment_approvals_updated_at BEFORE UPDATE ON public.payment_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX payment_approvals_account_status_idx ON public.payment_approvals (bank_account_id, status);

-- 4. Transaction receipts
CREATE TABLE public.transaction_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_account_id text NOT NULL,
  transaction_ref text NOT NULL,
  path text NOT NULL,
  filename text,
  content_type text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_ref, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_receipts TO authenticated;
GRANT ALL ON public.transaction_receipts TO service_role;
ALTER TABLE public.transaction_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account owners read receipts" ON public.transaction_receipts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.user_owns_bank_account(auth.uid(), bank_account_id));
CREATE POLICY "Owners attach receipts" ON public.transaction_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.user_owns_bank_account(auth.uid(), bank_account_id));
CREATE POLICY "Uploader updates receipt" ON public.transaction_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Uploader deletes receipt" ON public.transaction_receipts FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER transaction_receipts_updated_at BEFORE UPDATE ON public.transaction_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX transaction_receipts_ref_idx ON public.transaction_receipts (transaction_ref);