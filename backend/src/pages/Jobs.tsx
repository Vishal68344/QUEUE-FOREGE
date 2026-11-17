import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Btn, Card, Empty, ErrorState, PageHeader, Skeleton, StatusBadge, useToast } from '../components/ui'
import { api, Job } from '../lib/api'
import { errMsg, fmtTime, JOB_TYPES, parsePayload } from '../lib/util'
import { useApi } from '../lib/useApi'

export function JobActions({ job, onDone }: { job: Job; onDone: () => void }) {
  const toast = useToast()
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); onDone() } catch (e) { toast(errMsg(e), 'error') }
  }
  return (
    <div className="flex gap-2">
      {job.status === 'failed' && <Btn onClick={() => run(() => api.retry(job.id), 'Job queued for retry')}>Retry</Btn>}
      {job.status === 'waiting' && <Btn variant="danger" onClick={() => run(() => api.cancel(job.id), 'Job cancelled')}>Cancel</Btn>}
    </div>
  )
}

export function CreateJobForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast()
  const [type, setType] = useState<string>(JOB_TYPES[0])
  const [queue, setQueue] = useState('')
  const [text, setText] = useState('{\n  \n}')
  const [busy, setBusy] = useState(false)
  const parsed = parsePayload(text)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (parsed.error) return
    setBusy(true)
    try { await api.createJob({ type, queue: queue || undefined, payload: parsed.value }); toast('Job created'); onCreated() }
    catch (err) { toast(errMsg(err), 'error') }
    finally { setBusy(false) }
  }
  return (
    <Card className="mb-6">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Job type
          <select className="mt-1" value={type} onChange={(e) => setType(e.target.value)}>{JOB_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="text-sm">Queue (optional)
          <input className="mt-1" value={queue} onChange={(e) => setQueue(e.target.value)} placeholder="default" />
        </label>
        <label className="text-sm md:col-span-2">Payload (JSON)
          <textarea className="mt-1 h-32 font-mono" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          {parsed.error && <span role="alert" className="text-xs text-rose-300">Invalid JSON: {parsed.error}</span>}
        </label>
        <div className="md:col-span-2"><Btn variant="primary" type="submit" disabled={busy || !!parsed.error}>{busy ? 'Creating…' : 'Create job'}</Btn></div>
      </form>
    </Card>
  )
}

export function JobTable({ jobs, onDone }: { jobs: Job[]; onDone: () => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-panel text-slate-400"><tr>{['ID', 'Type', 'Queue', 'Status', 'Created', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">
          {jobs.map((j) => (
            <tr key={j.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-mono"><Link className="text-electric-soft hover:underline" to={`/jobs/${j.id}`}>{String(j.id).slice(0, 8)}</Link></td>
              <td className="px-4 py-3">{j.type ?? j.name}</td><td className="px-4 py-3">{j.queue ?? '—'}</td>
              <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
              <td className="px-4 py-3 text-slate-400">{fmtTime(j.createdAt)}</td>
              <td className="px-4 py-3"><JobActions job={j} onDone={onDone} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Jobs() {
  const { data, error, loading, reload } = useApi(api.jobs)
  const [show, setShow] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = (data ?? []).filter((j) =>
    (status === 'all' || j.status === status) &&
    `${j.id} ${j.type} ${j.queue ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHeader title="Jobs" sub="Create, search and manage background jobs." action={<Btn variant="primary" onClick={() => setShow(!show)}>{show ? 'Close form' : 'New job'}</Btn>} />
      {show && <CreateJobForm onCreated={() => { setShow(false); reload() }} />}
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="max-w-xs" placeholder="Search by ID, type or queue" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" />
        <select className="max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          {['all', 'waiting', 'active', 'completed', 'failed', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <Skeleton className="h-64" /> : error ? <ErrorState message={error} onRetry={reload} /> :
        filtered.length ? <JobTable jobs={filtered} onDone={reload} /> : <Empty title="No jobs found" hint="Create a job or adjust your filters." />}
    </>
  )
}

export function JobDetail() {
  const { id = '' } = useParams()
  const { data: j, error, loading, reload } = useApi(() => api.job(id), [id])
  if (loading) return <Skeleton className="h-64" />
  if (error || !j) return <ErrorState message={error ?? 'Job not found'} onRetry={reload} />
  const rows: [string, React.ReactNode][] = [
    ['Status', <StatusBadge status={j.status} />], ['Type', j.type], ['Queue', j.queue ?? '—'],
    ['Attempts', j.attempts ?? 0], ['Created', fmtTime(j.createdAt)], ['Finished', fmtTime(j.finishedAt)],
  ]
  return (
    <>
      <PageHeader title={`Job ${j.id}`} sub="Job detail" action={<JobActions job={j} onDone={reload} />} />
      <Card><dl className="grid gap-4 sm:grid-cols-3">{rows.map(([k, v]) => <div key={k}><dt className="text-sm text-slate-400">{k}</dt><dd className="mt-1">{v}</dd></div>)}</dl></Card>
      {j.error && <Card className="mt-4 border-rose-500/30"><h2 className="mb-2 font-medium text-rose-200">Error</h2><pre className="whitespace-pre-wrap font-mono text-sm text-rose-300">{j.error}</pre></Card>}
      {(['payload', 'result'] as const).map((k) => j[k] !== undefined && (
        <Card key={k} className="mt-4"><h2 className="mb-2 font-medium capitalize text-white">{k}</h2><pre className="overflow-x-auto font-mono text-sm text-slate-300">{JSON.stringify(j[k], null, 2)}</pre></Card>
      ))}
      <Link to="/jobs" className="mt-6 inline-block text-sm text-electric-soft hover:underline">Back to jobs</Link>
    </>
  )
}
