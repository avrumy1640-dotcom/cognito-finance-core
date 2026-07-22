
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_id_uniq
  ON public.webhook_events (provider, event_id)
  WHERE event_id IS NOT NULL;
