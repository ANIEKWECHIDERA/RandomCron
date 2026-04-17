# RandomCron

RandomCron is a full-stack cronjob monitoring and management app. It runs multiple randomized HTTP workers concurrently, records execution history, sends Resend alerts on failures, and provides a React dashboard for managing jobs and inspecting responses.

## Stack

- Backend: Node.js, TypeScript, Express, Prisma
- Database: SQLite for local development, schema designed to move to PostgreSQL later
- Frontend: React, TypeScript, Vite
- UI: shadcn/ui components from the shadcn registry
- Charts: Recharts
- Email: Resend
- HTTP execution: native `fetch`, no axios

## Local Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev:all
```

That starts both apps:

- Backend API and scheduler: `http://localhost:3000`
- Frontend dashboard: `http://localhost:5173`

The Vite dev server proxies `/api` to `http://localhost:3000`.

You can also run them separately:

```bash
npm run dev      # backend
npm run dev:web  # frontend
```

## Production

```bash
cp .env.production.example .env
$env:DATABASE_PROVIDER="postgresql" # PowerShell
npm run prisma:generate
npm run prisma:deploy
npm run build
npm start
```

The backend serves the built frontend from `dist/public`.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_PROVIDER` | `sqlite` | Use `sqlite` locally and `postgresql` in production. |
| `DATABASE_URL` | `file:./dev.db` | SQLite local database. Use a PostgreSQL URL after switching the Prisma provider. |
| `PORT` | `3000` | Express API and production frontend port. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS origin for Vite development. |
| `RESEND_API_KEY` | empty | Enables failure alert delivery when set with both alert emails. |
| `ALERT_TO_EMAIL` | empty | Default alert recipient. |
| `ALERT_FROM_EMAIL` | empty | Default verified Resend sender. |
| `LOG_LEVEL` | `info` | Pino log level. |

## Architecture

The backend stores `Cronjob` and `CronjobExecution` records with Prisma. Deletes are hard deletes with cascade, so deleting a cronjob also removes its execution history.

The scheduler owns one timer per enabled cronjob. Each job schedules its next run only after the current run finishes, which prevents overlapping executions for the same cronjob while allowing different cronjobs to run concurrently. Failed jobs use exponential backoff with jitter and are disabled after `maxRetries` consecutive failures.

The execution layer reuses the native-fetch request logic:

- `AbortController` timeouts
- non-2xx failure handling unless `allowNon2xx` is enabled
- JSON pretty-printing when possible
- text/html/plain text capture without dangerous rendering
- safe truncation for previews
- persisted request/response headers and bodies

The API masks sensitive request headers such as authorization and tokens before sending cronjob or execution data to the frontend.

## API Coverage

- `GET /api/cronjobs`
- `POST /api/cronjobs`
- `GET /api/cronjobs/:id`
- `PATCH /api/cronjobs/:id`
- `POST /api/cronjobs/:id/enable`
- `POST /api/cronjobs/:id/disable`
- `DELETE /api/cronjobs/:id`
- `POST /api/cronjobs/bulk/enable`
- `POST /api/cronjobs/bulk/disable`
- `POST /api/cronjobs/bulk/delete`
- `GET /api/cronjobs/:id/executions`
- `GET /api/executions/:id`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/charts`
- `GET /api/dashboard/recent-events`
- `GET /api/dashboard/failure-streaks`

## Scripts

```bash
npm run dev:all          # backend + frontend together
npm run dev              # backend API and scheduler only
npm run dev:web          # Vite dashboard only
npm run build            # backend and frontend production build
npm start                # run production server
npm run typecheck        # backend typecheck
npm run typecheck:web    # frontend typecheck
npm run prisma:generate  # generate Prisma client for selected DATABASE_PROVIDER
npm run prisma:migrate   # local migration for selected DATABASE_PROVIDER
npm run prisma:deploy    # deploy migrations for selected DATABASE_PROVIDER
npm run test:phase1      # persistence smoke test
npm run test:phase2      # multi-job scheduler test
npm run test:phase3      # API flow test
```

## Database Modes

Local SQLite:

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./dev.db"
```

Production PostgreSQL:

```env
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://user:password@host:5432/randomcron?schema=public"
```

The Prisma command wrapper chooses the schema dynamically:

- SQLite schema: `prisma/schema.prisma`
- PostgreSQL schema: `prisma/postgresql/schema.prisma`

Set `DATABASE_PROVIDER` before running `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:deploy`, or `npm run build`.

## Docker

```bash
docker build -t randomcron .
docker run --env-file .env -p 3000:3000 randomcron
```

## Notes

Prisma migration files are included under `prisma/migrations`. In this local Node 24 environment, Prisma's schema engine returned a blank engine error, so the app also includes an idempotent `ensureDatabase` startup helper that applies the same SQLite tables. On a standard Node 20/22 production runtime, `npm run prisma:deploy` can be used normally.
