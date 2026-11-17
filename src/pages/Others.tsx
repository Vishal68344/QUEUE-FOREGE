import { useState } from 'react'
import { Btn, Card, Empty, ErrorState, PageHeader, Skeleton, StatusBadge, useToast } from '../components/ui'
import { api, API_URL } from '../lib/api'
import { useSocketStatus } from '../lib/socket'
import { useApi } from '../lib/useApi'
import { errMsg, fmtTime } from '../lib/util'
import { JobTable } from './Jobs'

export function Queues() {
  const { data, error, loading, reload } = useApi(api.queues)
  const toast = useToast()
  const toggle = async (name: string, paused?: boolean) => {
    try { await (paused ? api.resume(name) : api.pause(name)); toast(paused ? `Resumed ${name}` : `Paused ${name}`); reload() }
    catch (e) { toast(errMsg(e), 'error') }
  }
  return (
    <>
      <PageHeader title="Queues" sub="Pause or resume processing per queue." />
      {loading ? <Skeleton className="h-40" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <Empty title="No queues yet" hint="Queues appear when the backend registers them." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((q) => (
            <Card key={q.name}>
              <div className="mb-4 flex items-center justify-between"><h2 className="font-medium text-white">{q.name}</h2><StatusBadge status={q.paused ? 'paused' : 'active'} /></div>
              <dl className="mb-4 grid grid-cols-4 gap-2 text-center text-sm">
                {(['waiting', 'active', 'completed', 'failed'] as const).map((k) => <div key={k}><dd className="text-lg font-semibold text-white">{q[k] ?? 0}</dd><dt className="text-xs text-slate-500">{k}</dt></div>)}
              </dl>
              <Btn onClick={() => toggle(q.name, q.paused)}>{q.paused ? 'Resume queue' : 'Pause queue'}</Btn>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

export function Workers() {
  const { data, error, loading, reload } = useApi(api.workers)
  return (
    <>
      <PageHeader title="Workers" sub="Processes that pick up and run jobs." />
      {loading ? <Skeleton className="h-40" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <Empty title="No workers connected" hint="Start a worker and it will show up here." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((w) => (
            <Card key={w.id}>
              <div className="mb-3 flex items-center justify-between"><h2 className="truncate font-medium text-white">{w.name ?? w.id}</h2><StatusBadge status={w.status} /></div>
              <p className="text-sm text-slate-400">Host: {w.host ?? '—'}</p>
              <p className="text-sm text-slate-400">Active jobs: {w.activeJobs ?? 0} · Processed: {w.processed ?? 0}</p>
              <p className="text-sm text-slate-400">Last heartbeat: {fmtTime(w.lastHeartbeat)}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

export function Failed() {
  const { data, error, loading, reload } = useApi(api.failed)
  return (
    <>
      <PageHeader title="Failed jobs" sub="Review errors and retry." />
      {loading ? <Skeleton className="h-64" /> : error ? <ErrorState message={error} onRetry={reload} /> : data?.length ? <JobTable jobs={data} onDone={reload} /> : <Empty title="No failed jobs" hint="Everything is running smoothly." />}
    </>
  )
}

export function Monitoring() {
  const health = useApi(api.health)
  const { connected, events } = useSocketStatus()
  return (
    <>
      <PageHeader title="Monitoring" sub="Backend health and live event stream." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium text-white">Backend health</h2>
          {health.loading ? <Skeleton className="h-24" /> : health.error ? <ErrorState message={health.error} onRetry={health.reload} /> : (
            <dl className="space-y-2 text-sm">{Object.entries(health.data ?? {}).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-slate-400">{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>)}</dl>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm">Socket.IO <StatusBadge status={connected ? 'online' : 'offline'} /></p>
        </Card>
        <Card>
          <h2 className="mb-3 font-medium text-white">Live events</h2>
          {events.length ? <ul className="space-y-1 font-mono text-xs">{events.map((e, i) => <li key={i} className="flex justify-between"><span>{e.name}</span><span className="text-slate-500">{e.time}</span></li>)}</ul> : <Empty title="Waiting for events" hint="Events show up here as jobs change state." />}
        </Card>
      </div>
    </>
  )
}

export function Settings() {
  const toast = useToast()
  const [secs, setSecs] = useState(localStorage.getItem('qf.refresh') ?? '15')
  const save = () => { localStorage.setItem('qf.refresh', secs); toast('Settings saved') }
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-lg space-y-4">
        <label className="block text-sm">Backend URL (set with VITE_API_URL)<input className="mt-1 opacity-60" value={API_URL} readOnly /></label>
        <label className="block text-sm">Refresh interval (seconds, minimum 5)<input className="mt-1" type="number" min={5} value={secs} onChange={(e) => setSecs(e.target.value)} /></label>
        <Btn variant="primary" onClick={save}>Save settings</Btn>
      </Card>
    </>
  )
}
