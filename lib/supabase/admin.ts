import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client. SERVER ONLY (server actions / route handlers). It bypasses RLS and
 * can create auth users, so only call it after requireRole(['admin']) has passed.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
