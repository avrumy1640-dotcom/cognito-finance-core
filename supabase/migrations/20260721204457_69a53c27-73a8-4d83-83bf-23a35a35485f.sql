ALTER TABLE public.kyc_profiles
  ADD COLUMN IF NOT EXISTS iberbanco_user_number text,
  ADD COLUMN IF NOT EXISTS iberbanco_status_raw text;
CREATE INDEX IF NOT EXISTS kyc_profiles_iberbanco_user_number_idx ON public.kyc_profiles (iberbanco_user_number);