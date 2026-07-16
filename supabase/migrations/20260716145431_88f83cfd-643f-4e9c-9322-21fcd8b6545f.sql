ALTER TABLE public.kyc_profiles
  ADD COLUMN IF NOT EXISTS column_person_id text,
  ADD COLUMN IF NOT EXISTS verification_tags text[];