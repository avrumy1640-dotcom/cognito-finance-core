
CREATE TYPE public.kyc_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

CREATE TABLE public.kyc_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_first_name TEXT NOT NULL,
  legal_last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  ssn_last4 TEXT NOT NULL CHECK (ssn_last4 ~ '^[0-9]{4}$'),
  id_type TEXT NOT NULL,
  id_number_last4 TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  employment_status TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.kyc_profiles TO authenticated;
GRANT ALL ON public.kyc_profiles TO service_role;

ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own kyc" ON public.kyc_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own kyc" ON public.kyc_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own kyc while unverified" ON public.kyc_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected', 'unverified'))
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_kyc_profiles_updated_at
BEFORE UPDATE ON public.kyc_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
