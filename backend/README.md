
# QueueForge Backend

A TypeScript and Express backend for QueueForge's distributed job orchestration platform.

## Architecture

- API: Express REST API, JWT authentication, MongoDB and Socket.IO.
- Worker: Independent BullMQ consumers for background jobs.
- Redis: Queue management, retries and worker events.
- MongoDB: Users, jobs, worker heartbeats and execution history.

## Requirements

- Node.js 22.12 or newer
- MongoDB 6 or newer
- Redis 6.2 or newer

## Setup

```bash
npm install
cp .env.example .env
```

Configure `MONGODB_URI`, Redis connection details and a strong `JWT_SECRET` of at least 32 characters.

## Development

Start the API:

```bash
npm run dev
```

Start the worker in another terminal:

```bash
npm run dev:worker
```

## Production

```bash
npm run build
npm run start
```

Start the worker separately:

```bash
npm run worker
```

At least one worker must be running to process queued jobs.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health status |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET/POST | `/api/jobs` | List or create jobs |
| GET | `/api/jobs/failed` | Failed jobs |
| GET | `/api/jobs/:id` | Job details |
| POST | `/api/jobs/:id/retry` | Retry job |
| POST | `/api/jobs/:id/cancel` | Cancel job |
| GET | `/api/queues` | Queue status |
| POST | `/api/queues/:name/pause` | Pause queue |
| POST | `/api/queues/:name/resume` | Resume queue |
| GET | `/api/workers` | Worker status |

## Docker

```bash
docker build -t queueforge-backend .
```

## Quality Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The Supertest suite tests HTTP behavior with mocked service boundaries. MongoDB and Redis are not required for those tests.
