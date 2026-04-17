# RandomCron Full Documentation

## Purpose

RandomCron is a full-stack cronjob monitoring and management app. It lets users create multiple randomized HTTP cronjobs, run them concurrently, observe live execution state, inspect request/response history, and receive failure alerts through Resend.

The original single-worker cronjob was refactored into a multi-job scheduler with a React dashboard and persistent execution history.

## Current Stack

- Backend: Node.js, TypeScript, Express
- Frontend: React, TypeScript, Vite
- UI: shadcn/ui components
- Data fetching/cache: React Query
- Realtime: Server-Sent Events
- Charts: Recharts
- Database ORM: Prisma
- Local database: SQLite
- Production database: PostgreSQL
- Email alerts: Resend
- HTTP client: native `fetch`; axios is not used

## Run Modes

### Local Development

Use SQLite locally.

`.env`:

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./dev.db"
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

Commands:

```bash
npm install
npm run prisma:generate
npm run dev:all
```

Open:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3000
```

### Production

Use PostgreSQL.

`.env.production`:

```env
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://user:password@host:5432/randomcron?schema=public"
PORT=3000
CLIENT_ORIGIN=https://your-domain.example
```

Commands:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run build
npm start
```

In production, Express serves the built frontend from `dist/public`.

## Database Strategy

Prisma datasource providers are schema-level, so the project uses separate schema files:

- SQLite: `prisma/schema.prisma`
- PostgreSQL: `prisma/postgresql/schema.prisma`

The wrapper script `src/scripts/prisma.ts` chooses the correct schema based on `DATABASE_PROVIDER`.

Supported values:

- `sqlite`
- `postgresql`
- `postgres`
- `prod`
- `production`

The app also has `ensureDatabase` for SQLite startup convenience. It should not be used as the production migration path. PostgreSQL production should use:

```bash
npm run prisma:deploy
```

## Data Model

### Cronjob

Tracks cronjob configuration and scheduler state:

- `id`
- `title`
- `url`
- `method`
- `headers`
- `body`
- `minIntervalMs`
- `maxIntervalMs`
- `timeoutMs`
- `maxRetries`
- `enabled`
- `currentStatus`
- `consecutiveFailures`
- `lastExecutionAt`
- `nextExecutionAt`
- `lastSuccessAt`
- `lastFailureAt`
- `alertToEmail`
- `alertFromEmail`
- `allowNon2xx`
- `createdAt`
- `updatedAt`

### CronjobExecution

Stores every execution result:

- `id`
- `cronjobId`
- `startedAt`
- `completedAt`
- `durationMs`
- `success`
- `statusCode`
- `statusText`
- `requestHeaders`
- `requestBody`
- `responseHeaders`
- `responseBody`
- `responsePreview`
- `parsedResponseType`
- `errorMessage`
- `retryAttempt`
- `alertSent`
- `createdAt`

Cronjob deletion is a hard delete with cascade, so deleting a cronjob removes its execution history.

## Scheduler Architecture

The scheduler lives in `src/scheduler/scheduler.ts`.

Core behavior:

- Loads enabled cronjobs on startup.
- Maintains one timer per enabled cronjob.
- Schedules each cronjob independently.
- Allows different cronjobs to run concurrently.
- Prevents duplicate overlapping runs for the same cronjob.
- Updates `nextExecutionAt` whenever a new timer is scheduled.
- Stops timers on disable/delete/shutdown.
- Waits briefly for in-flight runs during shutdown.

The executor lives in `src/scheduler/executor.ts`.

Core behavior:

- Executes native `fetch` with `AbortController` timeout.
- Persists each execution.
- Updates cronjob status and failure counters.
- Sends Resend alerts on failure when configured.
- Sends final stopping alert when max retries is reached.
- Emits realtime events after persisted state changes.

## Retry And Backoff

Normal successful cronjobs wait a random uniform interval between:

- `minIntervalMs`
- `maxIntervalMs`

Failed cronjobs use exponential backoff with jitter, capped at `maxIntervalMs`.

`maxIntervalMs` is capped by validation at 14 minutes:

```text
840000 ms
```

Manual enable resets `consecutiveFailures` to `0` so a previously stopped cronjob can start fresh.

## Realtime Architecture

Realtime is implemented with Server-Sent Events.

Endpoint:

```text
GET /api/realtime/events
```

Backend pieces:

- `src/realtime/hub.ts`
- `src/realtime/events.ts`

Frontend pieces:

- `frontend/src/components/realtime-provider.tsx`
- `frontend/src/lib/realtime.ts`
- `frontend/src/components/live-status.tsx`

The frontend shows connection state:

- `Live`
- `Reconnecting`
- `Disconnected`

Event payloads are compact and include preview data, IDs, status values, timing, retry count, and fetch keys for full execution detail.

Large response bodies are not pushed over SSE for list/dashboard use. Execution details are fetched from:

```text
GET /api/executions/:id
```

## Realtime Event Types

- `connected`
- `cronjob.created`
- `cronjob.updated`
- `cronjob.enabled`
- `cronjob.disabled`
- `cronjob.deleted`
- `cronjob.scheduled`
- `execution.started`
- `execution.succeeded`
- `execution.failed`
- `execution.retry_changed`
- `cronjob.failure_count_changed`
- `cronjob.final_stopped`

Events are emitted only after persistence or in a reliable state-change sequence so the frontend stays aligned with database truth.

## API Routes

Health:

- `GET /api/health`

Cronjobs:

- `GET /api/cronjobs`
- `POST /api/cronjobs`
- `GET /api/cronjobs/:id`
- `PATCH /api/cronjobs/:id`
- `POST /api/cronjobs/:id/enable`
- `POST /api/cronjobs/:id/disable`
- `DELETE /api/cronjobs/:id`

Bulk:

- `POST /api/cronjobs/bulk/enable`
- `POST /api/cronjobs/bulk/disable`
- `POST /api/cronjobs/bulk/delete`

History:

- `GET /api/cronjobs/:id/executions?page=1&pageSize=20`
- `GET /api/executions/:id`

Dashboard:

- `GET /api/dashboard/stats`
- `GET /api/dashboard/charts`
- `GET /api/dashboard/recent-events`
- `GET /api/dashboard/failure-streaks`

Realtime:

- `GET /api/realtime/events`

## Frontend Pages

### Dashboard

File:

```text
frontend/src/pages/dashboard.tsx
```

Includes:

- Enabled cronjobs card
- Disabled cronjobs card
- Successful cronjobs card
- Failed cronjobs card
- Response time chart
- Success vs failure chart
- Last events table
- Consecutive failures list
- Live connection status in app chrome

The dashboard response-time chart only includes enabled cronjobs. It draws a separate line for each active cronjob and aligns every line by run number (`Run 1`, `Run 2`, and so on) instead of absolute timestamp. This keeps all active trendlines starting from the same left edge and avoids the awkward visual where a newer cronjob starts halfway across the chart. Display values are capped to avoid one large response, such as `53160 ms`, flattening normal responses like `231 ms`. Tooltips still show actual response time.

### Cronjobs

File:

```text
frontend/src/pages/cronjobs.tsx
```

Includes:

- Search
- Paginated table
- Page size options: 10, 20, 30, 40, 50
- Selection checkboxes
- Bulk enable/disable/delete
- Row actions
- Create/edit dialog

Row actions are state-aware:

- Active jobs show Disable
- Disabled jobs show Enable

### Cronjob Details

File:

```text
frontend/src/pages/cronjob-details.tsx
```

Includes:

- Cronjob status overview
- Per-cronjob response time chart
- Per-cronjob success/failure chart
- Overview tab
- Paginated history tab
- Response data tab
- Settings tab
- Execution detail modal

Individual cronjob response-time charts are scoped to the selected cronjob and keep the real execution timestamp on the x-axis. The run-number alignment is only used on the main dashboard where multiple active cronjobs are overlaid for comparison.

History page size options:

- 10
- 20
- 30
- 40
- 50

## Response Body Handling

The backend attempts to parse JSON responses for readable display. Otherwise, it stores raw text.

Rules:

- JSON is pretty-printed in the frontend.
- HTML/text is displayed as text, not rendered as HTML.
- Large previews are truncated for dashboards/tables.
- Full body is available from execution detail fetches.

This avoids XSS from arbitrary endpoint responses.

## Security Notes

- URL and interval inputs are validated.
- `MAX_INTERVAL_MS` cannot exceed 14 minutes.
- Headers such as authorization, token, secret, password, and API key are masked before frontend serialization.
- Arbitrary HTML responses are never dangerously rendered.
- Resend keys must remain in environment variables.
- Production should run behind HTTPS.

## Important Scripts

```bash
npm run dev:all          # backend + frontend
npm run dev              # backend only
npm run dev:web          # frontend only
npm run build            # full production build
npm start                # run dist server
npm run typecheck        # backend typecheck
npm run typecheck:web    # frontend typecheck
npm run prisma:generate  # generate Prisma client for selected provider
npm run prisma:migrate   # dev migration for selected provider
npm run prisma:deploy    # production migration deploy
npm run test:phase1      # persistence smoke test
npm run test:phase2      # scheduler test
npm run test:phase3      # API test
npm run test:realtime    # SSE realtime lifecycle test
```

## Testing Notes

Current test coverage includes:

- Persistence smoke test
- Multi-cronjob scheduler concurrency test
- REST API CRUD and bulk action test
- Realtime lifecycle test for success and failure events
- TypeScript checks for backend and frontend
- Vite production build

Useful commands:

```bash
npm run typecheck
npm run typecheck:web
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:realtime
npm run build
```

## Known Operational Notes

On Windows, Prisma client generation can fail with an `EPERM` DLL rename error if a running Node process has Prisma’s query engine loaded. Stop local dev servers before running:

```bash
npm run prisma:generate
```

or:

```bash
npm run build
```

## Agent Handoff Notes

When modifying this app:

- Preserve native `fetch`; do not add axios.
- Keep scheduler state changes persisted before realtime broadcasts.
- Do not send huge response bodies over SSE.
- Patch React Query cache from realtime events where practical.
- Use API refetch only for detail/full-body cases or as safety fallback.
- Keep shadcn/ui components for UI primitives.
- Keep SQLite and PostgreSQL schemas in sync when changing models.
- Run backend and frontend typechecks before finishing.
