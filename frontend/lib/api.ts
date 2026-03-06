import { supabase } from './supabase'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'

/**
 * Thin HTTP client for the Wave Super Admin backend.
 * Automatically attaches the current Supabase session JWT as Bearer token.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try { const body = await res.json(); message = body.message ?? message } catch {}
    throw new Error(message)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export const api = {
  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v))
      })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(url.toString(), { headers })
    return handleResponse<T>(res)
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(res)
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(res)
  },

  async delete<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers })
    return handleResponse<T>(res)
  },
}
