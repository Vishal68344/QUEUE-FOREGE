export const JOB_TYPES = ['email', 'report', 'image-processing', 'webhook', 'data-sync'] as const

export function parsePayload(text: string): { value?: unknown; error?: string } {
  if (!text.trim()) return { value: {} }
  try {
    return { value: JSON.parse(text) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export const unwrapList = <T,>(d: any): T[] =>
  Array.isArray(d) ? d : d?.data ?? d?.jobs ?? d?.items ?? d?.queues ?? d?.workers ?? []

export const errMsg = (e: any): string =>
  e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Something went wrong'

export const fmtTime = (v?: string | number) => (v ? new Date(v).toLocaleString() : '—')
export const refreshMs = () => Math.max(5, Number(localStorage.getItem('qf.refresh') ?? 15)) * 1000
