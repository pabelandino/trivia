# Trivia Game

Live multiplayer trivia app built with Next.js, Tailwind CSS, and Supabase.

## Features

- Admin creates multiple-choice questions and opens a shareable lobby link
- Participants join with a display name only
- Admin sees connected players in real time
- Timer auto-advances from question to reveal and to the next question
- Mobile-first UI with cheerful typography

## Local setup

```bash
cd trivia
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase migration

Run the SQL migration once in the Supabase SQL editor:

`supabase/migrations/20250804180000_init.sql`

Or with the Supabase CLI:

```bash
supabase db push
```

## GitHub Pages (free hosting)

1. Push this repo to GitHub
2. Add repository secrets (Settings → Secrets and variables → Actions):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Enable Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. On push to `main`, the workflow `Deploy GitHub Pages` builds and publishes the site

Live URL: `https://pabelandino.github.io/trivia/`

Apply Supabase RPC migration for client-side hosting:

`supabase/migrations/20250804190000_game_rpc.sql`

## GitHub Actions secrets

Configure these repository secrets for CI and deploy:

| Secret | Scope |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public |
| `SUPABASE_URL` | Server only |
| `SUPABASE_PUBLISHABLE_KEY` | Server only |
| `SUPABASE_SECRET_KEY` | Server only |
| `VERCEL_TOKEN` | Deploy only |
| `VERCEL_ORG_ID` | Deploy only |
| `VERCEL_PROJECT_ID` | Deploy only |

Never commit `.env.local` or secret keys.

## App flow

1. Admin goes to `/admin`, creates a trivia, and adds questions
2. Admin opens the lobby and shares `/play/{CODE}`
3. Participants enter a name and wait in the lobby
4. Admin starts questions; timer and reveal advance automatically
5. Everyone sees correct answers and the live leaderboard
