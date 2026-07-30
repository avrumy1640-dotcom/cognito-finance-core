UPDATE public.column_entities
SET verification_status = lower(trim(verification_status))
WHERE verification_status IS NOT NULL
  AND verification_status <> lower(trim(verification_status));