# Workspace Rules & Directives

## Supabase & Git Workflow Rules
1. **Supabase Sync**: Whenever a new SQL migration or table schema change is written or modified in `supabase/migrations/`, immediately push it to the live Supabase project using `npx supabase db push`.
2. **Git Auto-Commit & Push**: Immediately after any file edit, migration, or feature addition, stage, commit with conventional commit messages, and push directly to `origin main` on GitHub.
