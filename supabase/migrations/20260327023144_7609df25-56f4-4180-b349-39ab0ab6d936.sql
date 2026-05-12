
-- Create table for site settings (lock/unlock, visitor limits)
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  max_users INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.site_settings (id, is_locked, max_users) 
VALUES ('00000000-0000-0000-0000-000000000001', false, 0);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);
-- Anyone can update (admin check done in app with hardcoded password)
CREATE POLICY "Anyone can update site settings" ON public.site_settings FOR UPDATE USING (true);

-- Create table for user sessions
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_name TEXT NOT NULL DEFAULT '',
  village_id TEXT NOT NULL DEFAULT '',
  village_name TEXT NOT NULL DEFAULT '',
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  form_progress JSONB NOT NULL DEFAULT '{}',
  form_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Everyone can read/write sessions
CREATE POLICY "Anyone can read user sessions" ON public.user_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert user sessions" ON public.user_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update user sessions" ON public.user_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete user sessions" ON public.user_sessions FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for site_settings
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
