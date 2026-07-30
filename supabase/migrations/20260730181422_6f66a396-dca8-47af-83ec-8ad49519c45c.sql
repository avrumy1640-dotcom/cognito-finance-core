REVOKE EXECUTE ON FUNCTION public.user_owns_bank_account(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_owns_bank_account(uuid, text) TO authenticated, service_role;