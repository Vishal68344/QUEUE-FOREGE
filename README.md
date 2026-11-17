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
