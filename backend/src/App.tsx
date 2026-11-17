import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { cx } from './components/ui'
import { useSocketStatus } from './lib/socket'
import Dashboard from './pages/Dashboard'
import { JobDetail, Jobs } from './pages/Jobs'
import { Failed, Monitoring, Queues, Settings, Workers } from './pages/Others'

const nav = [
  ['/', 'Overview'], ['/jobs', 'Jobs'], ['/queues', 'Queues'], ['/workers', 'Workers'],
  ['/failed', 'Failed jobs'], ['/monitoring', 'Monitoring'], ['/settings', 'Settings'],
]

export default function App() {
  const [open, setOpen] = useState(false)
  const { connected } = useSocketStatus()
  return (
    <div className="min-h-screen lg:flex">
      <aside className={cx('fixed inset-y-0 left-0 z-40 w-60 border-r border-line bg-panel p-4 transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="mb-8 flex items-center gap-2 px-2 text-lg font-bold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-electric">Q</span>QueueForge
        </div>
        <nav className="space-y-1">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => cx('block rounded-lg px-3 py-2 text-sm', isActive ? 'bg-electric/15 text-electric-soft' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="absolute bottom-4 left-6 flex items-center gap-2 text-xs text-slate-500">
          <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-rose-400')} />
          {connected ? 'Live updates on' : 'Live updates off'}
        </p>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg border border-line px-3 py-1.5">☰</button>
          <span className="font-semibold text-white">QueueForge</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/queues" element={<Queues />} />
            <Route path="/workers" element={<Workers />} />
            <Route path="/failed" element={<Failed />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
