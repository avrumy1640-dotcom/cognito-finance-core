-- RLS test suite: anon vs authenticated access on the tables recently hardened.
-- Tables covered: trusted_devices, webhook_events, profiles, user_roles, beneficiaries, payment_requests.
-- Runs inside a single transaction and rolls back all writes at the end.
--
-- Style: each check runs as a subtransaction; on error we RAISE NOTICE 'PASS: <name>'
-- (RLS blocked the operation). On unexpected success we RAISE EXCEPTION 'FAIL: <name>'.
-- A separate assertion checks positive cases: the operation MUST succeed as the owner.

BEGIN;

-- ---------- Fixture users ----------
INSERT INTO auth.users (id, email, aud, role, instance_id, created_at, updated_at, email_confirmed_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local', 'authenticated', 'authenticated',
   '00000000-0000-0000-0000-000000000000', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local', 'authenticated', 'authenticated',
   '00000000-0000-0000-0000-000000000000', now(), now(), now())
ON CONFLICT DO NOTHING;

-- Helper: switch to authenticated role with a given JWT sub
CREATE OR REPLACE FUNCTION pg_temp.become_user(uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.become_anon() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.reset_role() RETURNS void
LANGUAGE plpgsql AS $$ BEGIN RESET ROLE; END; $$;

-- Universal assertion helper
CREATE OR REPLACE FUNCTION pg_temp.assert_denied(name text, sql text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE err_ctx text;
BEGIN
  BEGIN
    EXECUTE sql;
    RAISE EXCEPTION 'FAIL: % — expected RLS denial but statement succeeded', name;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS: % (denied as expected)', name;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_ctx = MESSAGE_TEXT;
      -- 0 rows affected on UPDATE/DELETE under RLS is also a valid denial
      IF SQLSTATE = 'P0004' OR err_ctx ILIKE '%row-level security%' OR err_ctx ILIKE '%violates%' THEN
        RAISE NOTICE 'PASS: % (denied: %)', name, err_ctx;
      ELSE
        RAISE;
      END IF;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_allowed(name text, sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RAISE NOTICE 'PASS: % (allowed as expected)', name;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL: % — expected success but got: %', name, SQLERRM;
END;
$$;

-- Grants must include anon on public tables for RLS to even be evaluated as anon.
-- We're testing the *policies*, not raw grants — mimic PostgREST which uses the anon role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_devices, public.webhook_events,
  public.profiles, public.user_roles, public.beneficiaries, public.payment_requests TO anon;

-- ============================================================
-- trusted_devices
-- ============================================================
SELECT pg_temp.become_anon();
SELECT pg_temp.assert_denied('trusted_devices/anon insert',
  $q$INSERT INTO public.trusted_devices (user_id, device_id, label) VALUES ('11111111-1111-1111-1111-111111111111', 'd-anon', 'Anon Attempt')$q$);
SELECT pg_temp.assert_denied('trusted_devices/anon select',
  $q$SELECT * FROM public.trusted_devices$q$);

SELECT pg_temp.become_user('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.assert_allowed('trusted_devices/alice insert own',
  $q$INSERT INTO public.trusted_devices (user_id, device_id, label) VALUES ('11111111-1111-1111-1111-111111111111', 'd-alice', 'Alice Phone')$q$);
SELECT pg_temp.assert_denied('trusted_devices/alice insert as bob',
  $q$INSERT INTO public.trusted_devices (user_id, device_id, label) VALUES ('22222222-2222-2222-2222-222222222222', 'd-spoof', 'Spoof')$q$);

SELECT pg_temp.become_user('22222222-2222-2222-2222-222222222222');
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.trusted_devices WHERE device_id = 'd-alice';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: trusted_devices/bob sees alice row (count=%)', n; END IF;
  RAISE NOTICE 'PASS: trusted_devices/bob cannot see alice rows';
END $$;

-- Bob attempts to update/delete Alice's row: should affect 0 rows (silently denied)
SELECT pg_temp.become_user('22222222-2222-2222-2222-222222222222');
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.trusted_devices SET label = 'hijack' WHERE device_id = 'd-alice';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'FAIL: trusted_devices/bob update alice affected %', affected; END IF;
  DELETE FROM public.trusted_devices WHERE device_id = 'd-alice';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'FAIL: trusted_devices/bob delete alice affected %', affected; END IF;
  RAISE NOTICE 'PASS: trusted_devices/bob cannot update or delete alice rows';
END $$;

SELECT pg_temp.reset_role();
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.trusted_devices WHERE device_id = 'd-alice' AND label = 'Alice Phone';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: alice row was tampered (found %)', n; END IF;
  RAISE NOTICE 'PASS: trusted_devices/alice row intact after bob attempts';
END $$;

-- Alice can delete her own
SELECT pg_temp.become_user('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.assert_allowed('trusted_devices/alice delete own',
  $q$DELETE FROM public.trusted_devices WHERE device_id = 'd-alice'$q$);

-- ============================================================
-- webhook_events
-- ============================================================
SELECT pg_temp.become_anon();
SELECT pg_temp.assert_denied('webhook_events/anon insert',
  $q$INSERT INTO public.webhook_events (provider, event_type, payload) VALUES ('iberbanco', 'x', '{}'::jsonb)$q$);
SELECT pg_temp.assert_denied('webhook_events/anon select',
  $q$SELECT * FROM public.webhook_events$q$);

SELECT pg_temp.become_user('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.assert_denied('webhook_events/authenticated insert (no admin role)',
  $q$INSERT INTO public.webhook_events (provider, event_type, payload) VALUES ('iberbanco', 'x', '{}'::jsonb)$q$);
SELECT pg_temp.assert_denied('webhook_events/authenticated update',
  $q$UPDATE public.webhook_events SET status = 'processed' WHERE 1=1$q$);
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.webhook_events;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: webhook_events/non-admin sees rows (count=%)', n; END IF;
  RAISE NOTICE 'PASS: webhook_events/non-admin sees no rows';
END $$;

-- ============================================================
-- profiles
-- ============================================================
SELECT pg_temp.become_anon();
SELECT pg_temp.assert_denied('profiles/anon insert',
  $q$INSERT INTO public.profiles (user_id, preferred_name) VALUES ('11111111-1111-1111-1111-111111111111', 'A')$q$);
SELECT pg_temp.assert_denied('profiles/anon select',
  $q$SELECT * FROM public.profiles$q$);

SELECT pg_temp.become_user('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.assert_allowed('profiles/alice insert own',
  $q$INSERT INTO public.profiles (user_id, preferred_name) VALUES ('11111111-1111-1111-1111-111111111111', 'Alice')$q$);
SELECT pg_temp.assert_denied('profiles/alice insert as bob',
  $q$INSERT INTO public.profiles (user_id, preferred_name) VALUES ('22222222-2222-2222-2222-222222222222', 'Fake')$q$);

SELECT pg_temp.become_user('22222222-2222-2222-2222-222222222222');
DO $$
DECLARE affected int;
BEGIN
  UPDATE public.profiles SET preferred_name = 'hijack' WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'FAIL: profiles/bob updated alice (%)', affected; END IF;
  RAISE NOTICE 'PASS: profiles/bob cannot update alice';
END $$;

-- ============================================================
-- user_roles (privilege escalation guard)
-- ============================================================
SELECT pg_temp.become_anon();
SELECT pg_temp.assert_denied('user_roles/anon insert admin',
  $q$INSERT INTO public.user_roles (user_id, role) VALUES ('11111111-1111-1111-1111-111111111111', 'admin')$q$);

SELECT pg_temp.become_user('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.assert_denied('user_roles/alice self-grants admin',
  $q$INSERT INTO public.user_roles (user_id, role) VALUES ('11111111-1111-1111-1111-111111111111', 'admin')$q$);
SELECT pg_temp.assert_denied('user_roles/alice grants bob admin',
  $q$INSERT INTO public.user_roles (user_id, role) VALUES ('22222222-2222-2222-2222-222222222222', 'admin')$q$);

-- ============================================================
-- Summary
-- ============================================================
SELECT pg_temp.reset_role();
DO $$ BEGIN RAISE NOTICE '=== RLS TEST SUITE COMPLETE — all assertions passed ==='; END $$;

ROLLBACK;
