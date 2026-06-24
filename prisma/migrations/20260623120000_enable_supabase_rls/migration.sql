-- Enable Row Level Security on every table in public schema.
--
-- Why: Supabase exposes public tables via its REST API. Without RLS, anyone with
-- the project URL + anon/publishable key could read or modify data directly.
--
-- Kofeko uses Prisma with the Postgres connection (postgres role / pooler), which
-- bypasses RLS. The Node backend and service_role storage access are unchanged.
-- No RLS policies are added for anon/authenticated, so direct Data API access is denied.
--
-- Safe for: User, Candidate, Session, Evaluation, and all other Prisma tables.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;
