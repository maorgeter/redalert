const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => get<Record<string, unknown>>('/health'),
  events: () => get<{ events: unknown[]; count: number }>('/api/events'),
  activeEvents: () => get<{ events: unknown[]; count: number }>('/api/events/active'),
  eventHistory: (limit = 100, offset = 0) =>
    get<{ events: unknown[]; count: number }>(`/api/events/history?limit=${limit}&offset=${offset}`),
  zones: () => get<{ zones: unknown[]; count: number }>('/api/zones'),
  geofences: () => get<unknown>('/api/geofences'),
  config: () => get<unknown>('/api/config'),
  toggleSource: (name: string, enabled: boolean) =>
    post<{ name: string; enabled: boolean }>(`/api/sources/${name}/toggle`, { enabled }),
}
