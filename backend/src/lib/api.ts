import axios from 'axios'
import { unwrapList } from './util'

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:4000'
export const http = axios.create({ baseURL: API_URL, timeout: 15000 })

export interface Job {
  id: string; type: string; status: string; queue?: string; name?: string
  payload?: unknown; result?: unknown; error?: string; attempts?: number
  createdAt?: string; finishedAt?: string
}
export interface Stats {
  total: number; completed: number; active: number; waiting: number; failed: number
  successRate?: number
  throughput?: { time: string; completed: number; failed?: number }[]
  recentActivity?: { id?: string; message: string; status?: string; time?: string }[]
}
export interface Queue { name: string; waiting: number; active: number; completed: number; failed: number; paused?: boolean }
export interface Worker { id: string; name?: string; status: string; host?: string; activeJobs?: number; processed?: number; lastHeartbeat?: string }

export const api = {
  health: () => http.get('/api/health').then((r) => r.data as Record<string, unknown>),
  stats: () => http.get<Stats>('/api/dashboard/stats').then((r) => r.data),
  jobs: () => http.get('/api/jobs').then((r) => unwrapList<Job>(r.data)),
  failed: () => http.get('/api/jobs/failed').then((r) => unwrapList<Job>(r.data)),
  job: (id: string) => http.get(`/api/jobs/${id}`).then((r) => (r.data?.job ?? r.data) as Job),
  createJob: (body: { type: string; queue?: string; payload: unknown }) => http.post('/api/jobs', body).then((r) => r.data),
  retry: (id: string) => http.post(`/api/jobs/${id}/retry`).then((r) => r.data),
  cancel: (id: string) => http.post(`/api/jobs/${id}/cancel`).then((r) => r.data),
  queues: () => http.get('/api/queues').then((r) => unwrapList<Queue>(r.data)),
  pause: (n: string) => http.post(`/api/queues/${encodeURIComponent(n)}/pause`).then((r) => r.data),
  resume: (n: string) => http.post(`/api/queues/${encodeURIComponent(n)}/resume`).then((r) => r.data),
  workers: () => http.get('/api/workers').then((r) => unwrapList<Worker>(r.data)),
}
