import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Empty, ErrorState, PageHeader, Skeleton, StatusBadge } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'

export default function Dashboard() {
  const stats = useApi(api.stats)
  const workers = useApi(api.workers)
  const s = stats.data
  const rate = s ? s.successRate ?? (s.completed + s.failed ? (s.completed / (s.completed + s.failed)) * 100 : 0) : 0
  const cards: [string, string | number | undefined][] = [
    ['Total jobs', s?.total], ['Completed', s?.completed], ['Active', s?.active],
    ['Waiting', s?.waiting], ['Failed', s?.failed], ['Success rate', s ? `${rate.toFixed(1)}%` : undefined],
  ]
  return (
    <>
      <PageHeader title="Overview" sub="Live state of your job queues and workers." />
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}
      {!stats.error && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {cards.map(([label, v]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              {stats.loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 text-2xl font-semibold text-white">{v ?? 0}</p>}
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-medium text-white">Job throughput</h2>
          {stats.loading ? <Skeleton className="h-64" /> : s?.throughput?.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={s.throughput}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f7bff" stopOpacity={0.5} /><stop offset="100%" stopColor="#2f7bff" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#1c2a4a" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#0e172d', border: '1px solid #1c2a4a', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="completed" stroke="#2f7bff" fill="url(#g)" strokeWidth={2} />
                  <Area type="monotone" dataKey="failed" stroke="#fb7185" fill="none" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No throughput data yet" hint="Charts appear once jobs start finishing." />}
        </Card>
        <Card>
          <h2 className="mb-4 font-medium text-white">Worker health</h2>
          {workers.loading ? <Skeleton className="h-32" /> : workers.error ? <p className="text-sm text-rose-300">{workers.error}</p> : workers.data?.length ? (
            <ul className="space-y-3">
              {workers.data.map((w) => (
                <li key={w.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{w.name ?? w.id}</span><StatusBadge status={w.status} />
                </li>
              ))}
            </ul>
          ) : <Empty title="No workers connected" hint="Start a worker to process jobs." />}
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-4 font-medium text-white">Recent activity</h2>
        {stats.loading ? <Skeleton className="h-24" /> : s?.recentActivity?.length ? (
          <ul className="divide-y divide-line">
            {s.recentActivity.map((a, i) => (
              <li key={a.id ?? i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{a.message}</span>
                <span className="flex items-center gap-3 text-slate-500">{a.status && <StatusBadge status={a.status} />}{a.time && new Date(a.time).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        ) : <Empty title="No recent activity" hint="Create a job to see it here." />}
      </Card>
    </>
  )
}
