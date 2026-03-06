/**
 * Seed script — creates two super-admin accounts in Supabase.
 * Run with:  node scripts/seed-admins.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://odoaloddscliruquvjgc.supabase.co'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb2Fsb2Rkc2NsaXJ1cXV2amdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgyNTM0MywiZXhwIjoyMDg3NDAxMzQzfQ.q-GenGjfoH9C49KW923sD7WlvgQ7tiUF8KwwsgwnBR0'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMINS = [
  { email: 'kishanmadhav3@gmail.com', password: 'wave_admin', role: 'super_admin' },
  { email: 'avinashg4@gmail.com',     password: 'wave_admin', role: 'super_admin' },
]

async function seedAdmin({ email, password, role }) {
  console.log(`\n──────────────────────────────────────`)
  console.log(`Processing: ${email}`)

  // ── Step 1: create or retrieve the Supabase auth user ──────────────────────
  let userId

  // Try creating first
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // skip email verification
  })

  if (createErr) {
    if (createErr.message?.toLowerCase().includes('already been registered') ||
        createErr.message?.toLowerCase().includes('already exists')) {
      // User already exists — fetch their id
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) throw listErr
      const existing = users.find(u => u.email === email)
      if (!existing) throw new Error(`Could not find existing user for ${email}`)
      userId = existing.id
      console.log(`  Auth user already exists — id: ${userId}`)

      // Reset their password to the canonical one
      const { error: pwErr } = await supabase.auth.admin.updateUserById(userId, { password })
      if (pwErr) throw pwErr
      console.log(`  Password reset to wave_admin ✓`)
    } else {
      throw createErr
    }
  } else {
    userId = created.user.id
    console.log(`  Auth user created — id: ${userId}`)
  }

  // ── Step 2: ensure a profiles row exists (the CMS portal creates this on    ──
  //           first login via GET /auth/me, but we want it present now)
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, email }, { onConflict: 'id' })
  if (profileErr) {
    console.warn(`  profiles upsert warning: ${profileErr.message}`)
  } else {
    console.log(`  profiles row ensured ✓`)
  }

  // ── Step 3: upsert into admin_users ────────────────────────────────────────
  const { error: adminErr } = await supabase
    .from('admin_users')
    .upsert(
      { id: userId, role, status: 'active' },
      { onConflict: 'id' },
    )
  if (adminErr) throw adminErr
  console.log(`  admin_users row upserted — role: ${role}, status: active ✓`)

  console.log(`  ✅ ${email} is ready to log in`)
}

async function main() {
  console.log('Wave Super Admin — seeding admin accounts')
  console.log('==========================================')

  for (const admin of ADMINS) {
    await seedAdmin(admin)
  }

  console.log('\n==========================================')
  console.log('All done. Login at http://localhost:3002/login')
  console.log('  Email:    kishanmadhav3@gmail.com  |  avinashg4@gmail.com')
  console.log('  Password: wave_admin')
  console.log('==========================================')
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message ?? err)
  process.exit(1)
})
