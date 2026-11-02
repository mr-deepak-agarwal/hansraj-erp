'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { check, fail, val } from '@/lib/util'

const ROLES = ['admin', 'teacher', 'hr', 'accounts', 'parent']

function admin() {
  try {
    return adminClient()
  } catch (e) {
    fail('/users', e instanceof Error ? e.message : 'Admin key missing')
  }
}

/** Turns "ADM260001, ADM260002" into student ids; fails if any number is unknown. */
async function studentIdsFor(s: Awaited<ReturnType<typeof requireRole>>['supabase'], raw: string | null) {
  const nums = (raw ?? '')
    .split(/[\s,;]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
  if (!nums.length) return []
  const { data, error } = await s.from('students').select('id, admission_no').in('admission_no', nums)
  check(error, '/users')
  const found = new Set((data ?? []).map((r: any) => r.admission_no))
  const missing = nums.filter((n) => !found.has(n))
  if (missing.length) fail('/users', `Unknown admission number(s): ${missing.join(', ')}`)
  return (data ?? []).map((r: any) => r.id as string)
}

export async function createUser(fd: FormData) {
  const { supabase: s } = await requireRole(['admin'])
  const full_name = val(fd, 'full_name')
  const email = val(fd, 'email')?.toLowerCase()
  const password = val(fd, 'password')
  const role = val(fd, 'role')

  if (!full_name || !email || !password || !role) fail('/users', 'Name, email, password and role are required')
  if (!ROLES.includes(role)) fail('/users', 'Invalid role')
  if (password.length < 8) fail('/users', 'Password must be at least 8 characters')

  let studentIds: string[] = []
  if (role === 'parent') {
    studentIds = await studentIdsFor(s, val(fd, 'admission_nos'))
    if (!studentIds.length) fail('/users', 'Enter at least one child admission number for a parent login')
  }

  const a = admin()
  const { data, error } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (error || !data.user) fail('/users', error?.message ?? 'Could not create the user')
  const uid = data.user.id

  // The sign-up trigger created a least-privilege profile; set the real role here (service role).
  const { error: e2 } = await a.from('profiles').upsert({ id: uid, full_name, email, role, active: true })
  if (e2) fail('/users', `User created but role not set: ${e2.message}`)

  if (studentIds.length) {
    const { error: e3 } = await a
      .from('parent_students')
      .insert(studentIds.map((student_id) => ({ parent_id: uid, student_id })))
    if (e3) fail('/users', `User created but children not linked: ${e3.message}`)
  }

  revalidatePath('/users')
  redirect(`/users?created=${encodeURIComponent(email)}`)
}

export async function changeRole(fd: FormData) {
  const { supabase: s, user } = await requireRole(['admin'])
  const id = val(fd, 'id')
  const role = val(fd, 'role')
  if (!id || !role || !ROLES.includes(role)) fail('/users', 'Invalid request')
  if (id === user.id) fail('/users', 'You cannot change your own role')
  const { error } = await s.from('profiles').update({ role }).eq('id', id)
  check(error, '/users')
  revalidatePath('/users')
  redirect('/users')
}

export async function setActive(fd: FormData) {
  const { user } = await requireRole(['admin'])
  const id = val(fd, 'id')
  const active = val(fd, 'active') === 'true'
  if (!id) fail('/users', 'Invalid request')
  if (id === user.id) fail('/users', 'You cannot disable your own account')
  const a = admin()
  // Block new sign-ins at the auth layer and cut off existing sessions at the database layer.
  const { error: e1 } = await a.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' })
  if (e1) fail('/users', e1.message)
  const { error: e2 } = await a.from('profiles').update({ active }).eq('id', id)
  check(e2, '/users')
  revalidatePath('/users')
  redirect('/users')
}

export async function resetPassword(fd: FormData) {
  await requireRole(['admin'])
  const id = val(fd, 'id')
  const password = val(fd, 'password')
  if (!id || !password) fail('/users', 'Enter a new password')
  if (password.length < 8) fail('/users', 'Password must be at least 8 characters')
  const { error } = await admin().auth.admin.updateUserById(id, { password })
  if (error) fail('/users', error.message)
  redirect('/users?reset=1')
}

/** Link one parent login to one child (a parent can have many children). */
export async function linkParent(fd: FormData) {
  const { supabase: s } = await requireRole(['admin'])
  const parent_id = val(fd, 'parent_id')
  const back = val(fd, 'back') ?? '/users'
  let student_id = val(fd, 'student_id')
  if (!student_id) {
    const ids = await studentIdsFor(s, val(fd, 'admission_no'))
    student_id = ids[0] ?? null
  }
  if (!parent_id || !student_id) fail(back, 'Pick a parent and a student')
  const { error } = await s
    .from('parent_students')
    .upsert({ parent_id, student_id }, { onConflict: 'parent_id,student_id', ignoreDuplicates: true })
  check(error, back)
  revalidatePath('/users')
  revalidatePath(back)
  redirect(back)
}

export async function unlinkParent(fd: FormData) {
  const { supabase: s } = await requireRole(['admin'])
  const parent_id = val(fd, 'parent_id')
  const student_id = val(fd, 'student_id')
  const back = val(fd, 'back') ?? '/users'
  if (!parent_id || !student_id) fail(back, 'Invalid request')
  const { error } = await s.from('parent_students').delete().eq('parent_id', parent_id).eq('student_id', student_id)
  check(error, back)
  revalidatePath('/users')
  revalidatePath(back)
  redirect(back)
}
