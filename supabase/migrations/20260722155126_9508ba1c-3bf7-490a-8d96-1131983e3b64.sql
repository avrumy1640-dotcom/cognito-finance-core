
DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM ('open','in_progress','waiting_customer','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_category AS ENUM ('question','problem','dispute','feature_request','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_message_author AS ENUM ('customer','agent','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category public.support_ticket_category NOT NULL DEFAULT 'question',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  related_transaction_id text,
  last_customer_reply_at timestamptz,
  last_agent_reply_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own open tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status <> 'closed')
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author public.support_message_author NOT NULL DEFAULT 'customer',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ticket messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Users insert own ticket messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND author = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status <> 'closed'
    )
  );

CREATE INDEX IF NOT EXISTS support_tickets_user_updated_idx
  ON public.support_tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx
  ON public.support_messages(ticket_id, created_at);

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
