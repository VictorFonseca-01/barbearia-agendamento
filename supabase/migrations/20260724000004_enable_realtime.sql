-- Enable Realtime publication for agendamentos table
BEGIN;
  -- Add agendamentos table to supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos;
COMMIT;
