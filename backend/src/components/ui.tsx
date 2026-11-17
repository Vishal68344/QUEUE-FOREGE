import { createContext, ReactNode, useCallback, useContext, useState } from 'react'

export const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('rounded-xl border border-line bg-panel p-5', className)}>{children}</div>
)

export const Skeleton = ({ className }: { className?: string }) => (
  <div data-testid="skeleton" className={cx('animate-pulse rounded-lg bg-white/5', className)} />
)

const tone: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-300', online: 'bg-emerald-500/15 text-emerald-300',
  healthy: 'bg-emerald-500/15 text-emerald-300', ok: 'bg-emerald-500/15 text-emerald-300',
  active: 'bg-electric/20 text-electric-soft', busy: 'bg-electric/20 text-electric-soft',
  waiting: 'bg-amber-500/15 text-amber-300', delayed: 'bg-amber-500/15 text-amber-300', idle: 'bg-slate-500/20 text-slate-300',
  failed: 'bg-rose-500/15 text-rose-300', offline: 'bg-rose-500/15 text-rose-300',
  cancelled: 'bg-slate-500/20 text-slate-400', paused: 'bg-slate-500/20 text-slate-300',
}
export const StatusBadge = ({ status }: { status: string }) => (
  <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium', tone[status?.toLowerCase()] ?? 'bg-slate-500/20 text-slate-300')}>{status}</span>
)

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
    <p className="font-medium text-slate-200">{title}</p>
    {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
  </div>
)

export const Btn = ({ variant = 'ghost', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) => (
  <button
    {...p}
    className={cx(
      'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      variant === 'primary' && 'bg-electric text-white hover:bg-blue-500',
      variant === 'ghost' && 'border border-line text-slate-200 hover:bg-white/5',
      variant === 'danger' && 'border border-rose-500/40 text-rose-300 hover:bg-rose-500/10',
      className,
    )}
  />
)

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5">
    <p className="font-medium text-rose-200">Couldn't load data</p>
    <p className="mt-1 text-sm text-rose-300/80">{message}. Check that the backend is running and VITE_API_URL is correct.</p>
    {onRetry && <Btn className="mt-3" onClick={onRetry}>Try again</Btn>}
  </div>
)

export const PageHeader = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
    {action}
  </div>
)

type ToastKind = 'success' | 'error'
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([])
  const push = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((i) => [...i, { id, msg, kind }])
    setTimeout(() => setItems((i) => i.filter((t) => t.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cx('rounded-lg border px-4 py-3 text-sm shadow-xl', t.kind === 'success' ? 'border-emerald-500/40 bg-emerald-950 text-emerald-200' : 'border-rose-500/40 bg-rose-950 text-rose-200')}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
