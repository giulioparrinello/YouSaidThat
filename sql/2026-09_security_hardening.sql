-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening — run ONCE in the Supabase SQL editor, BEFORE deploying
-- the code that ships with it (the server inserts into predictions.public_key).
-- Idempotent: safe to re-run.
--
-- Why RLS matters here even though the app never uses supabase-js:
-- Supabase exposes every table in the `public` schema through its REST Data API
-- (PostgREST) to the `anon` and `authenticated` roles. Tables created by
-- `drizzle-kit push` have RLS DISABLED, so anyone holding the project's anon
-- key can read/write them directly, bypassing Express entirely — including
-- email_queue (plaintext emails + confirmation tokens) and waitlist.
--
-- The Express server connects with the `postgres` role, which owns the tables
-- and therefore bypasses RLS (we do NOT use FORCE ROW LEVEL SECURITY). So
-- "RLS on, no policies" = Data API locked out, backend unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Row Level Security on every app table (no policies = deny all for
--    anon/authenticated; table owner and service_role bypass it).
ALTER TABLE public.predictions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attestations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_votes ENABLE ROW LEVEL SECURITY;

-- 2. Belt and braces: remove the Data API roles' grants outright, and stop
--    Supabase's default privileges from granting them on future tables.
REVOKE ALL ON public.predictions, public.attestations, public.email_queue,
              public.waitlist, public.prediction_votes
  FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 3. Attestation key bound at seal time (see POST /api/predictions/claim).
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS public_key text;

-- 4. Unique (prediction_id, voter_fingerprint) — required by the vote upsert's
--    ON CONFLICT target. Dedupe first (keep the most recent vote), then add
--    the constraint only if no equivalent unique index already exists.
DELETE FROM public.prediction_votes a
  USING public.prediction_votes b
  WHERE a.prediction_id = b.prediction_id
    AND a.voter_fingerprint = b.voter_fingerprint
    AND (a.created_at, a.id) < (b.created_at, b.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'prediction_votes'
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(i.indkey) k
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
      ) = ARRAY['prediction_id', 'voter_fingerprint']
  ) THEN
    ALTER TABLE public.prediction_votes
      ADD CONSTRAINT prediction_votes_prediction_id_voter_fingerprint_unique
      UNIQUE (prediction_id, voter_fingerprint);
  END IF;
END $$;

COMMIT;

-- ─── Verification (run after) ────────────────────────────────────────────────
-- Every row must show rowsecurity = true:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Must return no rows for anon/authenticated:
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');
-- From outside (replace ref + anon key) — must NOT return data:
--   curl "https://<ref>.supabase.co/rest/v1/email_queue?select=*" \
--        -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
