-- 1. Team roles on account access + invitations
ALTER TABLE public.joint_owner_requests ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'joint';

CREATE OR REPLACE FUNCTION private.user_can_manage_account(_user_id uuid, _bank_account_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_owners
    WHERE user_id = _user_id
      AND bank_account_id = _bank_account_id
      AND role IN ('primary','joint','admin')
  );
$$;

-- 2. Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_account_id text,
  invoice_number text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invoices_user_number_idx ON public.invoices (user_id, invoice_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Reimbursements
CREATE TABLE public.reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id text NOT NULL,
  requester_user_id uuid NOT NULL,
  amount_cents bigint NOT NULL,
  description text NOT NULL,
  receipt_path text,
  status text NOT NULL DEFAULT 'pending',
  decision_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  transfer_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reimbursements_account_idx ON public.reimbursements (bank_account_id);

GRANT SELECT, INSERT, UPDATE ON public.reimbursements TO authenticated;
GRANT ALL ON public.reimbursements TO service_role;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters see their own requests" ON public.reimbursements
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_user_id OR private.user_can_manage_account(auth.uid(), bank_account_id));

CREATE POLICY "Account members can request" ON public.reimbursements
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_user_id
    AND private.user_owns_bank_account(auth.uid(), bank_account_id)
    AND status = 'pending'
  );

CREATE POLICY "Managers decide requests" ON public.reimbursements
  FOR UPDATE TO authenticated
  USING (private.user_can_manage_account(auth.uid(), bank_account_id))
  WITH CHECK (private.user_can_manage_account(auth.uid(), bank_account_id));

CREATE TRIGGER reimbursements_updated_at BEFORE UPDATE ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
