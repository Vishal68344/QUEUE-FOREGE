<<<<<<< HEAD
# QueueForge Frontend

React + TypeScript + Vite + Tailwind dashboard for QueueForge. Uses Axios for REST, Recharts for charts and Socket.IO Client for live updates.

## Setup
```bash
cp .env.example .env     # set VITE_API_URL to the backend URL
npm install
npm run dev              # http://localhost:5173
npm run build
npm test
```

`VITE_API_URL` is used for both REST and Socket.IO. No statistics are hardcoded; every number comes from the API.

## Docker
```bash
docker build --build-arg VITE_API_URL=http://localhost:4000 -t queueforge-frontend .
docker run -p 3000:80 queueforge-frontend
```

## API contract
`GET /api/health`, `GET /api/dashboard/stats`, `GET|POST /api/jobs`, `GET /api/jobs/failed`, `GET /api/jobs/:id`, `POST /api/jobs/:id/retry|cancel`, `GET /api/queues`, `POST /api/queues/:name/pause|resume`, `GET /api/workers`.

Expected shapes are defined in `src/lib/api.ts`. List endpoints may return a bare array or `{ data | jobs | items | queues | workers: [] }`. Stats: `{ total, completed, active, waiting, failed, successRate?, throughput?: [{time, completed, failed}], recentActivity?: [{message, status, time}] }`.

Socket.IO: any event received triggers a data refresh; a polling fallback (Settings, default 15s) keeps data fresh.

Confirm field names with the backend owner against `src/lib/api.ts` when integrating.
=======
# QueueForge Backend

A TypeScript/Express backend for QueueForge's distributed job orchestration platform. The API persists users, jobs, worker heartbeats, queue settings, and execution history in MongoDB. Redis and BullMQ handle asynchronous delivery and processing. The API and worker are separate processes.

## Architecture

- **API process:** Express REST API, JWT authentication, request validation, MongoDB persistence, queue administration, and a Socket.IO server.
- **Worker process:** Independent BullMQ consumers for the `emails` and `reports` queues. Each worker registers itself in MongoDB and refreshes its heartbeat.
- **Redis:** BullMQ queue state, delayed retry scheduling, and a Redis pub/sub channel used to relay worker events to the API's Socket.IO server.
- **MongoDB:** Durable application records, job metadata/results, worker registry, queue configuration, and append-only execution history.

The configured queues are `emails`, `reports`, and `dead-letter`. The worker consumes the first two; terminal failures are copied to `dead-letter` and remain available for inspection or a later dead-letter consumer.

## Requirements

- Node.js 22.12 or newer
- MongoDB 6 or newer
- Redis 6.2 or newer

## Setup

```bash
cd QueueForge/backend
npm install
cp .env.example .env
```

Edit `.env` and set `MONGODB_URI`, Redis connection details, and a strong `JWT_SECRET` (at least 32 characters). For local services, typical values are `mongodb://127.0.0.1:27017/queueforge` and `REDIS_HOST=127.0.0.1`. When running in a container network, use the actual service hostnames (for example, `mongo` and `redis`), not `localhost`.

### Run the API and worker separately

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:worker
```

Production build and execution:

```bash
npm run build
npm run start
```

In a second process/container, run:

```bash
npm run worker
```

The API does not start an in-process worker. Starting only the API will accept and persist jobs, but they will remain queued until at least one worker process is running.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime mode: `development`, `test`, or `production` | `development` |
| `PORT` | HTTP API port | `4000` |
| `MONGODB_URI` | MongoDB connection URI; required | none |
| `REDIS_URL` | Optional full Redis connection URL; takes precedence over host/port | empty |
| `REDIS_HOST` | Redis service hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_USERNAME` | Optional Redis ACL username | empty |
| `REDIS_PASSWORD` | Optional Redis password | empty |
| `REDIS_DB` | Redis database number (used with host/port configuration) | `0` |
| `REDIS_TLS` | Enable TLS when using host/port configuration | `false` |
| `JWT_SECRET` | JWT signing secret; required and at least 32 characters | none |
| `JWT_EXPIRES_IN` | JWT lifetime accepted by `jsonwebtoken` (for example `1h`, `7d`) | `1h` |
| `BCRYPT_ROUNDS` | Password hashing cost, from 8 to 15 | `12` |
| `CORS_ORIGIN` | Comma-separated allowed browser origins | `http://localhost:3000` |
| `QUEUE_DEFAULT_ATTEMPTS` | Default BullMQ attempts for newly created jobs | `3` |
| `QUEUE_DEFAULT_BACKOFF_MS` | Initial exponential-backoff delay in milliseconds | `1000` |
| `QUEUE_REMOVE_ON_COMPLETE` | Number of completed BullMQ jobs retained per queue | `500` |
| `WORKER_ID` | Optional stable worker identifier; set a distinct value for each worker replica | generated per process |
| `WORKER_CONCURRENCY` | Concurrent jobs per queue consumer (the process runs one consumer for each of `emails` and `reports`) | `5` |
| `WORKER_HEARTBEAT_INTERVAL_MS` | Worker heartbeat interval | `10000` |
| `WORKER_STALE_AFTER_MS` | Heartbeat age after which a worker is reported offline | `30000` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Authentication rate-limit window in milliseconds | `900000` |
| `AUTH_RATE_LIMIT_MAX` | Maximum register/login requests per IP per window | `30` |

Do not commit `.env` or place MongoDB/Redis passwords in source files. The API and worker share the same MongoDB and Redis environment settings.

## API contract

All responses use this envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

`meta` is included for paginated results. Errors use:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid",
    "details": {}
  }
}
```

Except for health and authentication, endpoints require `Authorization: Bearer <accessToken>`.

### Authentication

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Register with `{ "email", "password" }` |
| `POST` | `/api/auth/login` | Login with `{ "email", "password" }` |
| `GET` | `/api/auth/me` | Return the authenticated account |

### Required endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | MongoDB/Redis readiness and service status |
| `GET` | `/api/dashboard/stats` | Job, worker, and queue summary |
| `GET` | `/api/jobs` | User's jobs; supports `page`, `limit`, `status`, `queue`, and `search` |
| `POST` | `/api/jobs` | Create a `send-email` or `generate-report` job |
| `GET` | `/api/jobs/failed` | User's failed jobs; supports `page` and `limit` |
| `GET` | `/api/jobs/:id` | Job record and ordered execution history |
| `POST` | `/api/jobs/:id/retry` | Submit another BullMQ generation for a failed job |
| `POST` | `/api/jobs/:id/cancel` | Remove a waiting/delayed job from its queue |
| `GET` | `/api/queues` | Queue pause state, settings, and BullMQ job counts |
| `POST` | `/api/queues/:name/pause` | Pause a configured queue globally |
| `POST` | `/api/queues/:name/resume` | Resume a configured queue |
| `GET` | `/api/workers` | Worker registry and heartbeat-derived status |

Pagination returns `data` as an array and the count information in `meta`:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

### Create-job examples

`POST /api/jobs` for the email demo:

```json
{
  "type": "send-email",
  "payload": {
    "to": "person@example.com",
    "subject": "QueueForge demo",
    "body": "Hello from a background job"
  },
  "attempts": 3,
  "backoffMs": 1000,
  "metadata": { "source": "api-demo" }
}
```

`POST /api/jobs` for report generation:

```json
{
  "type": "generate-report",
  "payload": {
    "reportType": "weekly",
    "parameters": { "team": "operations", "rows": [{ "task": "index-jobs", "status": "complete" }] }
  }
}
```

The email processor is intentionally a demo transport: it records a simulated delivery result and does not send external email. The report processor builds a JSON report from `payload.parameters.rows` (when supplied) and includes the remaining parameters as report filters.

## Queue processing and failure behavior

Jobs use BullMQ's `attempts` and exponential `backoff` options. `attempts` and `backoffMs` may be supplied per job; otherwise queue defaults from MongoDB configuration/environment are used. Each attempt writes an execution-history entry. Terminal failures update the MongoDB job record to `failed` and are copied to the `dead-letter` queue with the original queue, payload, failure reason, and attempt count. Manual retry keeps the same MongoDB job record but submits a new BullMQ job ID (`<record-id>-rN`). Cancellation is allowed only while the BullMQ job is waiting or delayed.

## Real-time events

Authenticated Socket.IO clients connect to the API origin and provide their JWT in the handshake:

```ts
const socket = io(API_URL, { auth: { token: accessToken } });
```

Events are scoped to the job owner's socket room when a `userId` is present:

- `job:created`
- `job:started`
- `job:completed`
- `job:retrying`
- `job:failed`
- `job:cancelled`
- `worker:status`
- `queue:status`

Worker processes publish to Redis; the API process bridges those messages to Socket.IO, so no worker needs to host a socket server.

## Docker

`Dockerfile` builds the TypeScript backend and runs the API by default. Build it from this directory:

```bash
docker build -t queueforge-backend .
```

Run the API with environment variables and service hostnames supplied by your deployment environment:

```bash
docker run --rm --name queueforge-api --env-file .env -p 4000:4000 queueforge-backend
```

Start a separate worker container from the same image by overriding the command:

```bash
docker run --rm --name queueforge-worker --env-file .env queueforge-backend npm run worker
```

The image includes a health check against `/api/health`. No Compose, CI/CD, frontend, or root-level infrastructure files are included in this backend directory.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The current Supertest suite tests the HTTP contract and validation behavior with service boundaries mocked. It does not require MongoDB or Redis to be running. For an end-to-end smoke test, start MongoDB, Redis, the API, and a worker, then register a user and submit one of the example jobs.
>>>>>>> origin/feature/backend
