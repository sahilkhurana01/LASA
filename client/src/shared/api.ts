import toast from 'react-hot-toast'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

function baseUrl() {
  // Prefer proxy (/api) in dev; allow override for prod
  return (import.meta.env.VITE_API_URL as string | undefined) || '/api'
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string | null; query?: Record<string, string | number | boolean | undefined | null> } = {},
): Promise<ApiResult<T>> {
  const url = new URL(baseUrl() + path, window.location.origin)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null || v === '') continue
      url.searchParams.set(k, String(v))
    }
  }

  const headers = new Headers(opts.headers || {})
  headers.set('Accept', 'application/json')
  if (opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`)

  try {
    const res = await fetch(url.toString(), { ...opts, headers })
    const text = await res.text()
    const json = text ? (JSON.parse(text) as any) : null
    if (!res.ok) return { ok: false, error: json?.error || json?.message || `Request failed (${res.status})`, status: res.status }
    return { ok: true, data: json as T }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export function toastApiError(result: ApiResult<any>) {
  if (result.ok) return
  toast.error(result.error)
}

