-- 1. payment_requests: allow requester (or admin) to delete their own pending requests
GRANT DELETE ON public.payment_requests TO authenticated;

DROP POLICY IF EXISTS "Requester deletes own pending request" ON public.payment_requests;
CREATE POLICY "Requester deletes own pending request"
  ON public.payment_requests FOR DELETE TO authenticated
  USING (
    (requester_id = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. transaction_category_rules: internal reference data — admins only
DROP POLICY IF EXISTS "Authenticated read active category rules" ON public.transaction_category_rules;
DROP POLICY IF EXISTS "Authenticated read category rules" ON public.transaction_category_rules;

CREATE POLICY "Admins read category rules"
  ON public.transaction_category_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.transaction_category_rules FROM anon;