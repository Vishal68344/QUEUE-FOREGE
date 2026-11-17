import { io, Socket } from 'socket.io-client'
import { useEffect, useRef, useState } from 'react'
import { API_URL } from './api'
import { refreshMs } from './util'

let socket: Socket | null = null
export const getSocket = (): Socket => (socket ??= io(API_URL, { transports: ['websocket', 'polling'] }))

/** Runs cb on any socket event (debounced) and on a polling interval as fallback. */
export function useLive(cb: () => void) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    const s = getSocket()
    let t: ReturnType<typeof setTimeout>
    const h = () => { clearTimeout(t); t = setTimeout(() => ref.current(), 400) }
    s.onAny(h)
    const iv = setInterval(() => ref.current(), refreshMs())
    return () => { s.offAny(h); clearInterval(iv); clearTimeout(t) }
  }, [])
}

export function useSocketStatus() {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<{ name: string; time: string }[]>([])
  useEffect(() => {
    const s = getSocket()
    setConnected(s.connected)
    const on = () => setConnected(true), off = () => setConnected(false)
    const any = (name: string) => setEvents((e) => [{ name, time: new Date().toLocaleTimeString() }, ...e].slice(0, 20))
    s.on('connect', on); s.on('disconnect', off); s.onAny(any)
    return () => { s.off('connect', on); s.off('disconnect', off); s.offAny(any) }
  }, [])
  return { connected, events }
}
