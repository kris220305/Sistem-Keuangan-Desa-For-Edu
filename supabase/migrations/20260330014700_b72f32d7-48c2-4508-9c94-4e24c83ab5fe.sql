
-- Groups table for group work mode
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id text NOT NULL,
  village_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read groups" ON public.groups FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert groups" ON public.groups FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update groups" ON public.groups FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete groups" ON public.groups FOR DELETE TO public USING (true);

-- Group members table
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  session_id text NOT NULL,
  user_name text NOT NULL DEFAULT '',
  is_leader boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, session_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read group_members" ON public.group_members FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert group_members" ON public.group_members FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update group_members" ON public.group_members FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete group_members" ON public.group_members FOR DELETE TO public USING (true);

-- Report submissions from group leaders
CREATE TABLE public.report_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  village_id text NOT NULL DEFAULT '',
  village_name text NOT NULL DEFAULT '',
  submitted_by text NOT NULL DEFAULT '',
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read report_submissions" ON public.report_submissions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert report_submissions" ON public.report_submissions FOR INSERT TO public WITH CHECK (true);

-- Add work mode and group_id to user_sessions
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS work_mode text NOT NULL DEFAULT 'individual';
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
