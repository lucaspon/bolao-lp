# Bolão da Copa 2026

Internal World Cup 2026 prediction pool for Lumina and OKT. Log in with your work
email, predict the score of every match, and climb the leaderboard.

- **+3** points for an exact score
- **+1** point for the correct result (right winner, or a draw you called)
- Bets are open until **1 hour before kickoff**

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind v4** — one Vercel deploy, UI and API together
- **Postgres** via **Drizzle ORM** (`postgres` driver) — local Postgres in dev, **Neon** in production
- **Resend** for the email login codes
- **jose** for a signed, 30-day session cookie (passwordless OTP login)

Why this shape: bets and results are *writes*, and Vercel's runtime filesystem is
read-only — so a "JSON on the server" can't persist them. A small Postgres handles
concurrent edits and the leaderboard query cleanly, and Next.js gives us the few
write endpoints without standing up separate infrastructure.

## Local development

You need Node 20+, a local Postgres (e.g. `brew install postgresql@15`), and the
[Doppler CLI](https://docs.doppler.com/docs/install-cli) — env vars are managed in
Doppler (project `lcm-bolao`), not in a committed `.env` file.

```bash
# 1. Install deps
npm install

# 2. Create a database
createdb bolao

# 3. Connect to Doppler (one time) — auto-scopes to lcm-bolao/dev via doppler.yaml
doppler login
doppler setup

# 4. Create the schema and seed fixtures (these run through `doppler run`)
npm run db:migrate
npm run db:seed

# 5. Run it
npm run dev   # http://localhost:3000
```

`npm run dev` and the `db:*` scripts wrap `doppler run`, so they inject env from
Doppler automatically. The variables the app expects are documented in
`.env.example`. To inspect or change them: `doppler secrets` / `doppler secrets set`.

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed the fixture schedule (idempotent) |
| `npm run db:studio` | Drizzle Studio (browse the DB) |

## How it works

- **Auth** (`lib/auth/`, `app/actions/auth.ts`): email must match an allowed domain
  (`ALLOWED_DOMAINS`). A 6-digit code is hashed and stored with a 10-minute TTL,
  emailed via Resend, then exchanged for a 30-day session cookie. The username is
  the email prefix.
- **Fixtures** (`scripts/seed.ts`, `lib/teams.ts`): 72 group-stage matches plus the
  full knockout bracket. Knockout teams start as placeholders ("Winner Group A") and
  are filled in by an admin as they're decided.
- **Betting window** (`lib/match.ts`): a bet can be saved only when both teams are
  known, the match hasn't been played, and kickoff is more than an hour away. This is
  enforced in the server action, not just the UI.
- **Scoring** (`lib/scoring.ts`): when an admin saves a result, every bet on that
  match is re-scored inside one transaction.
- **Admin** (`/admin`, admin-only): fill knockout teams, adjust kickoff times, enter
  final scores.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add a **Neon Postgres** database from the Vercel Marketplace (Storage tab). It
   injects `DATABASE_URL` automatically — use the **pooled** connection string.
3. Add a [Resend](https://resend.com) API key, verify a sending domain, and set
   `EMAIL_FROM` to an address on it.
4. Set the remaining env vars in Vercel (Production + Preview):
   `AUTH_SECRET`, `ADMIN_EMAILS`, `ALLOWED_DOMAINS`, `EMAIL_FROM`. You can fill the
   Doppler `prd` config and use the [Doppler → Vercel
   integration](https://docs.doppler.com/docs/vercel) to sync these automatically.
5. Apply the schema and seed against Neon once (point `DATABASE_URL` at the Neon
   string): `npm run db:migrate && npm run db:seed`.
6. Deploy.

## Notes & future work

- Seeded fixtures are a best-effort snapshot of the draw — verify dates and group
  assignments against the official schedule. Everything is admin-editable.
- A knockout decided on penalties can't award the +1 "winner" point from an equal
  score; add a penalty-winner field if you want that.
- Possible next steps: match-kickoff reminders, per-stage bonus scoring, and a
  session-revocation table.
