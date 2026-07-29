-- Explicitly deny client-side writes; service_role bypasses RLS.
CREATE POLICY "No client inserts on column_bank_accounts" ON public.column_bank_accounts FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates on column_bank_accounts" ON public.column_bank_accounts FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on column_bank_accounts" ON public.column_bank_accounts FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY "No client inserts on column_transfers" ON public.column_transfers FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates on column_transfers" ON public.column_transfers FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on column_transfers" ON public.column_transfers FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY "No client inserts on column_entities" ON public.column_entities FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates on column_entities" ON public.column_entities FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on column_entities" ON public.column_entities FOR DELETE TO authenticated, anon USING (false);

REVOKE INSERT, UPDATE, DELETE ON public.column_bank_accounts, public.column_transfers, public.column_entities FROM authenticated, anon;
GRANT SELECT ON public.column_bank_accounts, public.column_transfers, public.column_entities TO authenticated;
GRANT ALL ON public.column_bank_accounts, public.column_transfers, public.column_entities TO service_role;