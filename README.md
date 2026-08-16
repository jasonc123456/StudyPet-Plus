# StudyPet+

AI Study Planner — flashcards, quizzes, weak-topic tracking, and a virtual study pet.

**[Live site](https://studypetplus.app/)**

## Prerequisites

- **Node.js 20** (matches CI)
- **npm** (lockfile: `package-lock.json`)
- **PostgreSQL 16** installed and running locally
- An **SMTP account** if you want real magic-link emails locally (or use the one-click demo)

> Local development uses a natively installed PostgreSQL (below). For a containerized **server deploy** instead, you only need **Docker** — see [Deployment (Docker Compose)](#deployment-docker-compose).

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at least:

| Variable                | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `DATABASE_URL`          | Postgres connection string                         |
| `NEXTAUTH_SECRET`       | Session signing secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL`          | App URL — `http://localhost:3000` for local dev    |
| `EMAIL_SERVER_HOST`     | SMTP host for magic-link emails                    |
| `EMAIL_SERVER_PORT`     | SMTP port (usually `587`)                          |
| `EMAIL_SERVER_USER`     | SMTP username                                      |
| `EMAIL_SERVER_PASSWORD` | SMTP password                                      |
| `EMAIL_FROM`            | From address on outgoing emails                    |
| `GEMINI_API_KEY`        | Google Gemini key for real flashcard/quiz AI       |
| `DEEPSEEK_API_KEY`      | Optional DeepSeek fallback if Gemini fails         |
| `AI_DEMO_MODE`          | `true` = canned demo cards only (skip real AI)     |

Never commit real secrets. `.env` is gitignored.

### 3. Install & start PostgreSQL (local)

Install **PostgreSQL 16** natively on your machine:

- **macOS** (Homebrew): `brew install postgresql@16 && brew services start postgresql@16`
- **Ubuntu/Debian**: `sudo apt install postgresql-16` (the service starts automatically; check with `sudo systemctl status postgresql`)
- **Windows**: download the installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) and keep the default port `5432`.

Then create the database and user that match `.env.example` (run `psql` as a superuser — e.g. `sudo -u postgres psql` on Linux, or `psql -U postgres`):

```sql
CREATE USER studypet WITH PASSWORD 'studypet';
CREATE DATABASE studypet OWNER studypet;
```

Default connection (already in `.env.example`):

- user: `studypet`
- password: `studypet`
- database: `studypet`
- port: `5432`

Verify it's reachable: `pg_isready -h localhost -p 5432`

### 4. Database setup

```bash
npx prisma generate
npx prisma migrate dev
```

`migrate dev` applies migrations and keeps the schema in sync. For production deploys, use `npx prisma migrate deploy` instead.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth & login

StudyPet+ uses **passwordless magic-link** sign-in (NextAuth v4 + Prisma adapter).

- **Sign in:** [http://localhost:3000/login](http://localhost:3000/login) — enter your email; click the link sent via SMTP.
- **After sign-in:** you are redirected to `/dashboard`.
- **Sign out:** use the Sign out control in the dashboard sidebar (calls NextAuth `signOut`).
- **One-click demo:** the landing page and login page link to `/api/demo-login`, which creates a temporary demo session without email. Useful for local UI testing.
- **Route protection:** `/dashboard` is gated by middleware (session cookie) and server-side `auth()` checks.

### Demo accounts (manual)

Demo user rows are **not seeded automatically** on a fresh clone. To create accounts:

1. Use the normal magic-link flow at `/login`, or
2. Run `npm run seed` only if your team has agreed on demo emails in `prisma/seed.mjs` and you have configured `.env`, or
3. Insert users through your database admin process.

Do not commit real credentials or production SMTP passwords.

## Scripts

| Command                     | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Start Next.js dev server                                      |
| `npm run build`             | Production build                                              |
| `npm run start`             | Serve production build                                        |
| `npm run lint`              | ESLint (Next.js + Prettier)                                   |
| `npm run seed`              | Run Prisma seed (`prisma/seed.mjs`) — manual demo setup only  |
| `./scripts/check-deploy.sh` | `npm ci`, Prisma generate, lint, and build (pre-deploy check) |

## CI

Pull requests and pushes to `main` run `.github/workflows/ci.yml`: install, `prisma generate`, lint, and build with safe placeholder env vars.

## Deployment (Docker Compose)

For a server deploy, a full containerized stack is provided — you do **not** need
Node or PostgreSQL installed on the host, only **Docker** (with the Compose
plugin). The stack runs three services:

```
TLS terminator (:443)  ──>  nginx (:80)  ──>  app (Next.js :3000)  ──>  postgres (:5432)
   you provide this          this stack        this stack               this stack
```

- **`postgres`** — PostgreSQL 16, data persisted in the `pgdata` named volume; not exposed to the host.
- **`app`** — the Next.js app built from the [Dockerfile](Dockerfile); runs `prisma migrate deploy` on boot, then `next start`. Not exposed directly — only nginx reaches it.
- **`nginx`** — reverse proxy, config in [deploy/nginx/conf.d/default.conf](deploy/nginx/conf.d/default.conf). Bound to `127.0.0.1:80` — it is the **internal** hop, not the public edge.

### HTTPS is required, and this stack does not provide it

Session cookies, magic-link sign-in URLs and MFA all cross the public origin, so
it must be HTTPS. **This stack has no public TLS listener** — you put a
terminator in front of it (the live deployment uses Nginx Proxy Manager; Caddy,
Traefik, a cloud load balancer, or another nginx all work). The terminator owns
the certificates, listens on :443, and redirects `http://` to `https://`.

Two things keep a misconfiguration from going unnoticed:

- The app **refuses to start** in production when `NEXTAUTH_URL` is not
  `https://` (see [src/instrumentation.ts](src/instrumentation.ts)), so a stack
  brought up with no terminator fails at boot instead of quietly serving
  authentication traffic in the clear.
- HSTS (`max-age=63072000; includeSubDomains`) is sent automatically once the
  origin is HTTPS, and is deliberately *not* sent otherwise — see
  [next.config.mjs](next.config.mjs).

To run the stack standalone with its own certificates instead, follow the notes
at the bottom of [deploy/nginx/conf.d/default.conf](deploy/nginx/conf.d/default.conf)
and publish `443` in [docker-compose.yml](docker-compose.yml).

### 1. Configure environment

```bash
cp .env.example .env
```

Set real values in `.env`:

- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `NEXTAUTH_URL` — the **public HTTPS** URL (e.g. `https://your-domain`); must match what users hit through the TLS terminator, or magic-link callbacks break. Production refuses to start if this is not `https://`.
- `EMAIL_SERVER_*` / `EMAIL_FROM` — SMTP for magic links.
- `GEMINI_API_KEY` (or `DEEPSEEK_API_KEY`) — required for real flashcard/quiz generation from notes. Leave `AI_DEMO_MODE` unset/`false`.
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — credentials for the bundled database (defaults: `studypet` / `studypet` / `studypet`).

`DATABASE_URL` is built automatically by Compose from the `POSTGRES_*` values and
points at the `postgres` service — you don't set it for the compose deploy.
`.env` is gitignored; never commit real secrets.

### 2. Build and start

```bash
docker compose up -d --build
```

Migrations are applied automatically when the `app` container starts. nginx then
serves the app on **127.0.0.1:80**, which is what you point your TLS terminator
at; users reach it at the `https://` origin you set in `NEXTAUTH_URL`.

### 3. Manage the stack

```bash
docker compose ps                 # service status
docker compose logs -f app        # follow app logs
docker compose exec postgres psql -U studypet -d studypet   # DB shell
docker compose down               # stop (add -v to also delete the DB volume)
```

### HTTPS

Port 80 is plaintext. To serve TLS, drop certs in `deploy/nginx/certs/`, then
uncomment the `443` block in the nginx config and the `certs` mount + `443`
port in [docker-compose.yml](docker-compose.yml). A typical setup terminates
TLS here (or behind an upstream proxy / Let's Encrypt companion).

## Troubleshooting

### Database connection errors

- Confirm Postgres is running: `pg_isready -h localhost -p 5432` (or check the service, e.g. `brew services list` / `sudo systemctl status postgresql`).
- Check `DATABASE_URL` matches your host, port, user, password, and database name.
- After changing the schema, run `npx prisma migrate dev` again.
- If migrations fail on a throwaway local DB, you can reset with `npx prisma migrate reset` (destroys local data).

### Magic-link email not arriving

- Verify all `EMAIL_SERVER_*` vars and `EMAIL_FROM` in `.env`.
- Many providers require app passwords or specific ports (587 + STARTTLS is typical).
- Check spam/junk folders.
- For UI work without SMTP, use **Try the demo** (`/api/demo-login`) instead.

### Auth redirect loops or “not signed in” on dashboard

- Ensure `NEXTAUTH_URL` matches the URL you open in the browser (including `http` vs `https`).
- `NEXTAUTH_SECRET` must be set and stable across restarts.
- Clear site cookies for `localhost` and sign in again.

### Health check

`GET /api/health` returns DB connectivity status — useful to confirm the app can reach Postgres.

## Project layout

```
src/
  app/           # Next.js App Router pages and API routes
  auth.ts        # NextAuth config + server-side auth() helper
  components/    # Shared UI (sidebar, sign-out, landing widgets)
  lib/prisma.ts  # Shared Prisma client
prisma/          # Schema and migrations
```
