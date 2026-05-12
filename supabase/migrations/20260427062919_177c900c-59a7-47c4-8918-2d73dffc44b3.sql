-- Per-village min/max group size settings managed by admin
CREATE TABLE IF NOT EXISTS public.village_group_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  village_id text NOT NULL UNIQUE,
  village_name text NOT NULL DEFAULT '',
  min_members integer NOT NULL DEFAULT 1,
  max_members integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.village_group_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read village_group_limits"
  ON public.village_group_limits FOR SELECT USING (true);
CREATE POLICY "Anyone can insert village_group_limits"
  ON public.village_group_limits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update village_group_limits"
  ON public.village_group_limits FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete village_group_limits"
  ON public.village_group_limits FOR DELETE USING (true);

CREATE TRIGGER update_village_group_limits_updated_at
  BEFORE UPDATE ON public.village_group_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime so changes propagate instantly to all users
ALTER PUBLICATION supabase_realtime ADD TABLE public.village_group_limits;
ALTER TABLE public.village_group_limits REPLICA IDENTITY FULL;