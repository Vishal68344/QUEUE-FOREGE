import { useCallback, useEffect, useRef, useState } from 'react'
import { errMsg } from './util'
import { useLive } from './socket'

export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try { setData(await fnRef.current()); setError(null) }
    catch (e) { setError(errMsg(e)) }
    finally { setLoading(false) }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, deps)
  useLive(() => load(true))
  return { data, error, loading, reload: () => load(true) }
}
