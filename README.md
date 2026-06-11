# Bolão da Copa 2026

A self-hostable World Cup 2026 prediction pool (a Brazilian *bolão*) for your team
or group of friends. Log in with email, predict the score of every match, optionally
put real money in via PIX, and climb the leaderboard. The whole thing is one Next.js
app on a single Vercel deploy. **You choose who can join** by setting the allowed
email domains (`ALLOWED_DOMAINS`).

- **+3** points for an exact score, **+1** for the correct result (right winner, or a draw you called)
- Each match's points are **weighted by stage** (a group game ×1 … the final ×13) and **Brazil matches count double**
- Predictions lock **1 hour before kickoff**
- Entries are collected by **PIX**; the **top 3** split the pot, weighted by points × stake

## Stack

| Concern | Choice |
| --- | --- |
| App + API | **Next.js 16** (App Router, server actions) + **React 19** + **Tailwind v4**, one Vercel deploy |
| Database | **Supabase Postgres** via **Drizzle ORM** (`postgres.js` driver, transaction pooler) |
| Auth | Passwordless email OTP → signed 30-day cookie (**jose**, HS256), emails via **Resend** |
| Live results | **football-data.org** API, pulled by a Vercel **cron** every 5 min |
| Money (PIX) | **Asaas** — free **static Pix QR codes**, reconciled by webhook |
| Secrets | **Doppler** (synced into Vercel) — no committed `.env` |
| Hosting | **Vercel** (Fluid Compute); custom domain via **Cloudflare** DNS |

Why this shape: bets, results and payments are all *writes*, and Vercel's runtime
filesystem is read-only — so "a JSON on the server" can't persist them. A small
Postgres handles concurrent edits and the leaderboard query cleanly, and Next.js
gives us the handful of write endpoints (server actions + two webhook/cron routes)
without standing up separate infrastructure.

## Infrastructure

### Database — Supabase Postgres (`lib/db/`)

Plain Postgres hosted on Supabase, accessed with Drizzle over the `postgres.js`
driver — **not** `supabase-js`, because we only use Supabase as the database, not
its auth/SDK. `DATABASE_URL` points at Supabase's **transaction pooler** (port
`6543`), which is required for serverless: the driver runs with `prepare: false`
(pgBouncer transaction mode can't use prepared statements) and a small connection
pool. Schema lives in `lib/db/schema.ts`; changes are versioned migrations
(`npm run db:generate` → `db:migrate`).

### Live results — football-data.org + cron (`lib/sync.ts`, `app/api/sync`)

The match schedule **and** results come from the [football-data.org](https://www.football-data.org)
API — it's the source of truth, so there's no manual fixture/score entry. A Vercel
cron (`vercel.json`, `*/5 * * * *`) hits `GET /api/sync` (guarded by a `CRON_SECRET`
bearer token); an admin can also trigger it from the `/admin` page. `syncMatches`
upserts every match **non-destructively** — it never overwrites a known team or
score with a transient `null`, and a finished match never un-finishes — and stamps
each match's points multiplier. Knockout slots show as labels ("Winner Group A",
"W74") until the API fills in the real teams.

### Payments — Asaas, free static PIX QR (`lib/asaas.ts`, `app/api/webhooks/asaas`)

Entries are collected by PIX through [Asaas](https://www.asaas.com) on a
*pessoa-física* account. The key cost decision:

- A **dynamic** Pix charge (`POST /payments`) costs **R$0,99 Pix fee + R$0,99
  "mensageria"** per receipt.
- A **static** Pix QR (`POST /pix/qrCodes/static`) is **free** — Asaas allows 100
  receipts/month — which more than covers a pool of a few dozen people.

So when a user generates a charge we mint **one static QR per payment** against the
pool's Pix key (`ASAAS_PIX_ADDRESS_KEY`) and store the QR's id on the payment row.
When they pay, Asaas auto-creates a charge carrying that **`pixQrCodeId`** and fires
a `PAYMENT_RECEIVED` webhook to `app/api/webhooks/asaas` (authenticated via the
`asaas-access-token` header). We match `pixQrCodeId` → payment row → mark that user
paid, with the received amount. No payer CPF or manual reconciliation needed —
*which* QR was paid tells us *who* paid.

**Stakes** (`lib/staking.ts`): variable amounts, floor **R$25**, cap **R$1000** per
user. Two windows — bet freely before the group stage starts, then a top-up window
between the end of the group stage and the start of the knockouts.

### Scoring & payout (`lib/match.ts`, `lib/scoring.ts`, `lib/payout.ts`)

Each bet scores **+3** (exact) / **+1** (result) / **0**, then multiplied by the
match's `pointsMultiplier` = **stage weight** (`group 1, R32 2, R16 3, QF 5, SF 8,
3rd 5, final 13`) **× 2 if Brazil plays**. When a match finishes, the sync re-scores
every bet on it in one transaction.

Only the **top 3** (by points, among people who paid) win; everyone else gets R$0.
The pot is split proportionally to a **phase-locked weight**:
`weight = (group points × stake paid before the group stage) + (knockout points ×
total stake)`. Locking the group-stage stake to what you paid *before* the group
stage removes the incentive to wait and see before betting big.

### Auth (`lib/auth/`, `app/actions/auth.ts`)

Email must match an allowed domain (`ALLOWED_DOMAINS`). A 6-digit code is hashed
(sha256 + `AUTH_SECRET`) and stored with a 10-minute TTL, emailed via Resend, then
exchanged for a 30-day signed session cookie (jose, HS256, httpOnly). The username
is the email prefix; `ADMIN_EMAILS` get the admin page.

## Local development

You need Node 20+, a local Postgres (e.g. `brew install postgresql@15`), and the
[Doppler CLI](https://docs.doppler.com/docs/install-cli) — env vars are managed in
Doppler, not in a committed `.env`.

```bash
npm install
createdb bolao

# Connect to Doppler (one time) — auto-scopes to the dev config via doppler.yaml
doppler login
doppler setup

# Schema, then pull the real fixtures from football-data (needs FOOTBALL_DATA_TOKEN)
npm run db:migrate
npm run db:sync

npm run dev   # http://localhost:3000
```

`npm run dev` and the `db:*` scripts wrap `doppler run`, so they inject env from
Doppler automatically. Every expected variable is documented in `.env.example`;
inspect/edit with `doppler secrets` / `doppler secrets set`.

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:sync` | Pull fixtures + results from football-data.org |
| `npm run db:seed` | Seed an offline fixture snapshot (no API needed) |
| `npm run db:studio` | Drizzle Studio (browse the DB) |

## Deploying to Vercel

1. Import the repo in Vercel.
2. Provision a **Supabase** project; use its **transaction-pooler** connection
   string (port `6543`) as `DATABASE_URL`.
3. Set the env vars below (Production + Preview). Easiest is to fill the Doppler
   `prd` config and use the [Doppler → Vercel integration](https://docs.doppler.com/docs/vercel)
   to sync them:

   | Group | Variables |
   | --- | --- |
   | Core | `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAILS`, `ALLOWED_DOMAINS` |
   | Email | `RESEND_API_KEY`, `EMAIL_FROM` (an address on a domain verified in Resend) |
   | Results | `FOOTBALL_DATA_TOKEN`, `CRON_SECRET` |
   | PIX / Asaas | `API_KEY_ASAAS`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_PIX_ADDRESS_KEY`, `WALLET_ASAAS`, `APP_URL` |

4. In the Asaas dashboard, register a **webhook** → `https://<APP_URL>/api/webhooks/asaas`
   for `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`, and set its access-token to match
   `ASAAS_WEBHOOK_TOKEN`.
5. Apply the schema and pull fixtures once against the prod DB:
   `npm run db:migrate && npm run db:sync`.
6. Deploy. The cron in `vercel.json` starts syncing results automatically.

## Notes & future work

- A knockout decided on penalties reports an equal score, so it can't award the
  +1 "result" point as-is; football-data exposes a `score.winner` field we could use
  to fix that.
- Possible next steps: kickoff reminders and a session-revocation table.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE) — free to use, modify and share
for any **noncommercial** purpose. Selling it or running it as a paid/commercial
service is not permitted.
