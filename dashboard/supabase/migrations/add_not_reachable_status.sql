-- ==============================================================================
-- Migration: Add 'not_reachable' to public.order_status Enum
-- Run this query in the Supabase SQL Editor:
-- ==============================================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'not_reachable';
