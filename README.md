# Random Cron Worker

A production-ready Node.js worker that pings a configurable HTTP endpoint at random intervals. It uses native `fetch`, timeout handling with `AbortController`, structured logs, retry backoff, and Resend email alerts.

## Requirements

- Node.js 20+
- A Resend API key for failure alerts

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

For production:

```bash
npm run build
npm start
```

## Configuration

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `TARGET_URL` | yes | none | Endpoint to ping. |
| `REQUEST_METHOD` | no | `GET` | Any standard HTTP method. |
| `REQUEST_TIMEOUT_MS` | no | `30000` | Fetch timeout. |
| `MIN_INTERVAL_MS` | no | `60000` | Minimum random wait before a normal request. |
| `MAX_INTERVAL_MS` | no | `840000` | Maximum random wait. It can never exceed 14 minutes. |
| `MAX_RETRIES` | no | `10` | Maximum consecutive failures before stopping. |
| `ALLOW_NON_2XX` | no | `false` | Set `true` to treat non-2xx responses as success. |
| `RESEND_API_KEY` | yes | none | Resend API key for alerts. |
| `ALERT_TO_EMAIL` | yes | none | Destination alert email. |
| `ALERT_FROM_EMAIL` | yes | none | Sender identity verified in Resend. |
| `AUTH_BEARER_TOKEN` | no | none | Adds an `Authorization: Bearer ...` header. |
| `CUSTOM_HEADERS` | no | `{}` | JSON object of extra headers. |
| `REQUEST_BODY` | no | none | Request body for methods like `POST` or `PUT`. |
| `LOG_LEVEL` | no | `info` | Pino log level. |

Startup validation fails fast if the URL is invalid, intervals are unsafe, JSON headers are malformed, or required alert settings are missing.

## Runtime Logic

The worker waits a uniform random delay between `MIN_INTERVAL_MS` and `MAX_INTERVAL_MS` before each normal ping. Failed requests increment a consecutive failure counter and retry with exponential backoff plus jitter. Retry waits are capped by `MAX_INTERVAL_MS`, which itself is capped at 840000 ms.

Each failed attempt sends one Resend alert with timestamp, endpoint, attempt number, error summary, and response details when available. If the worker reaches `MAX_RETRIES`, it sends a final stopping alert and exits with a non-zero code.

## Scripts

```bash
npm run dev        # run TypeScript directly
npm run build      # compile to dist
npm start          # run compiled worker
npm run typecheck  # type-check without emitting
npm run pm2:start  # start with PM2 sample config
```

## Docker

```bash
docker build -t random-cron-worker .
docker run --env-file .env random-cron-worker
```

## PM2

```bash
npm run build
npm run pm2:start
```

The sample PM2 config runs one worker process and lets the app terminate with a non-zero code after max failures. PM2 can then restart it according to your process policy.

## Response Logging

Each request logs:

- timestamp
- request method and URL
- status code and status text
- useful response headers
- parsed and pretty-printed JSON when possible
- text/html/plain text bodies otherwise
- truncation metadata for large bodies

## Shutdown

The worker handles `SIGINT` and `SIGTERM`. If it is sleeping, shutdown interrupts the sleep. If a request is already in flight, the app lets that request finish, logs the result, and then exits the loop.
