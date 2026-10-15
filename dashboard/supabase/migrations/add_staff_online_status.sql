-- ==============================================================================
-- BOYON OMS: STAFF ONLINE / AWAY PRESENCE STATUS MIGRATION
-- ==============================================================================

-- 1. Add is_online column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- 2. Index for quick online status lookup
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);
