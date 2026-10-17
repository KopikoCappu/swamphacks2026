import dotenv from 'dotenv';

// Imported first by index.ts so every module sees the env. `.env.local` holds the Supabase vars pulled from
// Vercel (`vercel env pull`); `.env` holds the AI keys. On Vercel itself both files are absent and real env vars are used.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
