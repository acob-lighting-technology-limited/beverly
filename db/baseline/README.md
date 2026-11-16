# Migration mirror

These four files are copies of the Beverly repo's `supabase/migrations/` call-centre migrations. Beverly is the source of truth;
this mirror exists so the API's integration tests and `pnpm dev:mock` can run the real SQL in an in-memory Postgres (PGlite).
Re-copy them whenever Beverly changes them: `pnpm db:sync` (set BEVERLY_REPO to the Beverly checkout).
