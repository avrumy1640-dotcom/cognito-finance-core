ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_dedupe_key_unique UNIQUE (user_id, dedupe_key);