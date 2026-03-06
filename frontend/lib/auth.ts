import { supabase } from './supabase'
import { api } from './api'

export interface AdminIdentity {
  id: string
  email: string
  role: 'maker' | 'checker' | 'admin' | 'super_admin'
  status: string
  permissions: string[]
  last_active_at: string | null
}

// In-memory cache — cleared on sign out
let _identity: AdminIdentity | null = null

/**
 * Sign in with Supabase, then verify admin identity via the backend.
 * This is the same two-step pattern used by the CMS portal:
 *   1. supabase.signInWithPassword  → session + JWT
 *   2. GET /auth/me (backend validates JWT + admin_users row) → role / perms
 */
export async function signInAdmin(email: string, password: string): Promise<AdminIdentity> {
  // Step 1 — Supabase auth
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw authError

  // Step 2 — Backend identity check (AdminAuthGuard verifies admin_users)
  const identity = await api.get<AdminIdentity>('/auth/me')
  _identity = identity
  return identity
}

/**
 * Returns the cached admin identity, or fetches it from the backend.
 * Returns null if the user is not authenticated or not an admin.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (_identity) return _identity

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const identity = await api.get<AdminIdentity>('/auth/me')
    _identity = identity
    return identity
  } catch {
    return null
  }
}

/**
 * Sign out and clear the cached identity.
 */
export async function signOut(): Promise<void> {
  _identity = null
  await supabase.auth.signOut()
}

/**
 * Returns the Supabase session JWT — used by the api client.
 */
export async function getSessionToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}
