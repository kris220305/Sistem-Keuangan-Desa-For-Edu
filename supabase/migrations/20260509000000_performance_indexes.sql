-- Performance optimization indexes to reduce Disk IO budget usage

-- user_sessions indexes - these columns are frequently queried
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_group_id ON public.user_sessions(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON public.user_sessions(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_village_id ON public.user_sessions(village_id);

-- group_members indexes - frequently joined and filtered
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_session_id ON public.group_members(session_id);

-- groups indexes - looked up by village frequently
CREATE INDEX IF NOT EXISTS idx_groups_village_id ON public.groups(village_id);

-- report_submissions indexes
CREATE INDEX IF NOT EXISTS idx_report_submissions_group_id ON public.report_submissions(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_submissions_created_at ON public.report_submissions(created_at DESC);

-- village_group_limits - typically queried by village_id
CREATE INDEX IF NOT EXISTS idx_village_group_limits_village_id ON public.village_group_limits(village_id);

-- Enable autovacuum for better maintenance (Supabase usually has this, but adding for safety)
ALTER TABLE public.user_sessions SET (
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_threshold = 50
);

ALTER TABLE public.group_members SET (
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_threshold = 50
);
