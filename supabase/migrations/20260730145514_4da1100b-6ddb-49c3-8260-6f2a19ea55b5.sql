DO $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids FROM auth.users WHERE email ~ '^demo[a-z0-9]*@example\.com$';
  IF ids IS NULL THEN RAISE NOTICE 'no demo users'; RETURN; END IF;

  DELETE FROM public.column_transfers WHERE user_id = ANY(ids);
  DELETE FROM public.column_bank_accounts WHERE user_id = ANY(ids);
  DELETE FROM public.column_entities WHERE user_id = ANY(ids);
  DELETE FROM public.column_counterparties WHERE user_id = ANY(ids);
  DELETE FROM public.kyc_profiles WHERE user_id = ANY(ids);
  DELETE FROM public.notifications WHERE user_id = ANY(ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(ids);
  DELETE FROM public.profiles WHERE user_id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);

  RAISE NOTICE 'deleted % demo users', array_length(ids, 1);
END $$;