CREATE TABLE public.account_statements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id text NOT NULL,
  report_id text NOT NULL UNIQUE,
  statement_type text NOT NULL DEFAULT 'bank_account_monthly_statement',
  period_start date,
  period_end date,
  pdf_document_id text,
  csv_document_id text,
  status text NOT NULL DEFAULT 'completed',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX account_statements_bank_account_idx ON public.account_statements (bank_account_id, period_end DESC);

GRANT SELECT ON public.account_statements TO authenticated;
GRANT ALL ON public.account_statements TO service_role;

ALTER TABLE public.account_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view statements for their accounts"
ON public.account_statements FOR SELECT TO authenticated
USING (private.user_owns_bank_account(auth.uid(), bank_account_id));

CREATE TRIGGER update_account_statements_updated_at
BEFORE UPDATE ON public.account_statements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();