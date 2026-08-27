-- ============================================================================
-- gen — Supabase Row Level Security (RLS)
--
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Policy model:
--   * Everyone (anon + authenticated) may READ published computer models.
--   * NO ONE may INSERT / UPDATE / DELETE through the public API keys
--     (publishable/anon) — writes happen exclusively through the server
--     using SUPABASE_SERVICE_ROLE_KEY which bypasses RLS by design.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every table
-- ---------------------------------------------------------------------------

ALTER TABLE public.computer_models ENABLE ROW LEVEL SECURITY;

-- If you later add more tables (variants, feedback, ...), enable them too:
-- ALTER TABLE public.computer_variants  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_feedback      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Public READ access (SELECT)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "public read computer models" ON public.computer_models;
CREATE POLICY "public read computer models"
  ON public.computer_models
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 3. Block all writes through public API roles
--
-- With RLS enabled and NO policy FOR INSERT/UPDATE/DELETE, every write from
-- anon/authenticated is denied automatically. The explicit REVOKEs below are
-- defense-in-depth at the privilege level.
-- ---------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.computer_models FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.computer_models FROM authenticated;

-- No write policies are created on purpose:
--   DROP POLICY IF EXISTS "public insert ..." ON public.computer_models;  -- never add one

-- ---------------------------------------------------------------------------
-- 4. Service role keeps full access (bypasses RLS implicitly as it is
--    defined in the `service_role` Postgres role with BYPASSRLS).
--    Nothing to grant here — this section is documentation.
-- ---------------------------------------------------------------------------
