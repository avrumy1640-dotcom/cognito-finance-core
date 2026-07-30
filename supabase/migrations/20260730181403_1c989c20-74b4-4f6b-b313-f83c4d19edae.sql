
CREATE TABLE public.account_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id text NOT NULL,
  user_id uuid NOT NULL,
  entity_id text,
  role text NOT NULL DEFAULT 'joint' CHECK (role IN ('primary','joint')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, user_id)
);
CREATE INDEX idx_account_owners_user ON public.account_owners(user_id);
CREATE INDEX idx_account_owners_account ON public.account_owners(bank_account_id);

GRANT SELECT ON public.account_owners TO authenticated;
GRANT ALL ON public.account_owners TO service_role;
ALTER TABLE public.account_owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_owns_bank_account(_user_id uuid, _bank_account_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_owners
    WHERE user_id = _user_id AND bank_account_id = _bank_account_id
  );
$$;

CREATE POLICY "Owners view owner list"
ON public.account_owners FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.user_owns_bank_account(auth.uid(), bank_account_id));

CREATE POLICY "No client inserts on account_owners"
ON public.account_owners FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates on account_owners"
ON public.account_owners FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No client deletes on account_owners"
ON public.account_owners FOR DELETE TO authenticated USING (false);

-- Backfill: every existing account's creator is its primary owner.
INSERT INTO public.account_owners (bank_account_id, user_id, entity_id, role)
SELECT bank_account_id, user_id, entity_id, 'primary'
FROM public.column_bank_accounts
ON CONFLICT (bank_account_id, user_id) DO NOTHING;

CREATE TABLE public.joint_owner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id text NOT NULL,
  requester_user_id uuid NOT NULL,
  invitee_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','canceled','revoked')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_user_id <> invitee_user_id)
);
CREATE UNIQUE INDEX idx_joint_req_pending
  ON public.joint_owner_requests(bank_account_id, invitee_user_id)
  WHERE status = 'pending';
CREATE INDEX idx_joint_req_invitee ON public.joint_owner_requests(invitee_user_id, status);
CREATE INDEX idx_joint_req_requester ON public.joint_owner_requests(requester_user_id, status);

GRANT SELECT ON public.joint_owner_requests TO authenticated;
GRANT ALL ON public.joint_owner_requests TO service_role;
ALTER TABLE public.joint_owner_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view their joint requests"
ON public.joint_owner_requests FOR SELECT TO authenticated
USING (requester_user_id = auth.uid() OR invitee_user_id = auth.uid());

CREATE POLICY "No client inserts on joint_owner_requests"
ON public.joint_owner_requests FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates on joint_owner_requests"
ON public.joint_owner_requests FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No client deletes on joint_owner_requests"
ON public.joint_owner_requests FOR DELETE TO authenticated USING (false);

CREATE TRIGGER trg_account_owners_updated
BEFORE UPDATE ON public.account_owners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_joint_owner_requests_updated
BEFORE UPDATE ON public.joint_owner_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Co-owners can read the account row and its transactions.
CREATE POLICY "Co-owners view column accounts"
ON public.column_bank_accounts FOR SELECT TO authenticated
USING (public.user_owns_bank_account(auth.uid(), bank_account_id));

CREATE POLICY "Co-owners view column transfers"
ON public.column_transfers FOR SELECT TO authenticated
USING (public.user_owns_bank_account(auth.uid(), bank_account_id));
