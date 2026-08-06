# NFL Wins Pool

A private pool for 10 friends: each manager drafts 3 NFL teams, and whoever's
three teams combine for the most regular-season wins takes the pool. Draft
order isn't a straight snake — each position gets 3 picks spread across the
board (the "Eldorado method") so no slot is systematically stronger.

Live at **nfl-wins.vaibhavramamoorthy.com**.

## How it works

1. **Sign in** with your phone number — only the 10 whitelisted numbers get in, no passwords.
2. **Draft lobby** shows the draft order, each manager's 3 pick numbers, and who's currently signed in.
3. **Draft board** is fully asynchronous — there's no timer and nobody gets auto-picked for. Your slot just waits until you submit a pick from your own device, whenever that is. Everyone else's picks show up as they make them.
4. **Leaderboard**, **weekly schedule**, and **team detail** pages track real standings pulled live from ESPN's public scoreboard/standings API — no manual score entry.

## Architecture

- **Next.js 16** (App Router, TypeScript) — one deployable service, UI + API routes together.
- **Postgres** (Railway) is the source of truth for draft picks and who's currently online — every manager's device sees the same draft, and nothing resets on redeploy.
- **Auth** is phone-number whitelist → signed session token (HMAC, no passwords, no third-party auth provider). The whitelist itself lives in an env var, never in source, since this repo is public.
- **NFL data** (scores, standings, team schedules) is fetched server-side from ESPN's free, unofficial JSON API and cached briefly — not stored in our own DB.
- **Team logos** are hotlinked from ESPN's CDN.
- Hosted on **Railway**, deployed from this repo's `main` branch.

## Local development

```bash
npm install
npm run dev
```

Requires these environment variables (see `railway.json` / Railway dashboard for the deployed values):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | HMAC secret for signing session tokens |
| `MANAGER_PHONES` | JSON array of `{"name","phone"}` — the sign-in whitelist |

## Notes

- Vegas win-total lines (`lib/teams.ts`) are a snapshot from Yahoo Sports at draft time — static for the season, not live odds.
- The draft order pattern and manager-to-position assignment live in `lib/draft.ts` / `lib/managers.ts`.
