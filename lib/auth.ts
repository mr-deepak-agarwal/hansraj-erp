import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'teacher' | 'hr' | 'accounts' | 'parent'
export const STAFF_ROLES: Role[] = ['admin', 'teacher', 'hr', 'accounts']

/** One entry per sidebar link: which roles may open it. */
export const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: '/', label: 'Dashboard', roles: STAFF_ROLES },
  { href: '/students', label: 'Students', roles: ['admin', 'teacher', 'accounts'] },
  { href: '/admissions', label: 'Admissions', roles: ['admin'] },
  { href: '/fees', label: 'Fees', roles: ['admin', 'accounts'] },
  { href: '/attendance', label: 'Attendance', roles: ['admin', 'teacher'] },
  { href: '/marks', label: 'Marks', roles: ['admin', 'teacher'] },
  { href: '/timetable', label: 'Timetable', roles: ['admin', 'teacher'] },
  { href: '/library', label: 'Library', roles: ['admin', 'teacher'] },
  { href: '/staff', label: 'Staff', roles: ['admin', 'hr'] },
  { href: '/users', label: 'Users', roles: ['admin'] },
  { href: '/setup', label: 'Setup', roles: ['admin'] },
]

/** Signed-in user + their role. Cached per request. Sends signed-out users to /login. */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !profile.active) redirect('/disabled')

  return {
    supabase,
    user,
    role: profile.role as Role,
    name: (profile.full_name as string | null) ?? user.email ?? '',
  }
})

/**
 * Use at the top of every page and server action. Row Level Security in the database is the
 * real lock; this gives users a clean redirect instead of empty pages.
 */
export async function requireRole(allowed: Role[]) {
  const s = await getSession()
  if (!allowed.includes(s.role)) {
    redirect(
      s.role === 'parent'
        ? '/parent'
        : `/?error=${encodeURIComponent('You do not have access to that page')}`
    )
  }
  return s
}
