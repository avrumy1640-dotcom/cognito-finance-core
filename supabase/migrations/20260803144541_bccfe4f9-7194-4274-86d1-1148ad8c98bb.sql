CREATE TABLE public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name text,
  dba_name text,
  ein text,
  ein_pending boolean NOT NULL DEFAULT false,
  registration_id text,
  legal_type text,
  industry text,
  website text,
  description text,
  date_of_incorporation date,
  state_of_incorporation text,
  country_of_incorporation text DEFAULT 'US',
  address_street text,
  address_line2 text,
  address_city text,
  address_region text,
  address_postal_code text,
  address_country text DEFAULT 'US',
  owner_title text,
  owner_ownership_percentage integer,
  person_entity_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own business profile"
ON public.business_profiles FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_business_profiles_updated_at
BEFORE UPDATE ON public.business_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();