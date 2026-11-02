'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, val } from '@/lib/util'

const STATUSES = new Set(['present', 'absent', 'late'])

export async function saveAttendance(fd: FormData) {
  const class_id = val(fd, 'class_id')
  const date = val(fd, 'date')
  if (!class_id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('/attendance', 'Pick a class and date')

  const rows: { student_id: string; date: string; status: string }[] = []
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('status_')) continue
    const status = String(value)
    if (!STATUSES.has(status)) continue
    rows.push({ student_id: key.slice('status_'.length), date, status })
  }
  if (!rows.length) fail('/attendance', 'No students to save')

  const { supabase: s } = await requireRole(['admin', 'teacher'])
  const { error } = await s.from('attendance').upsert(rows, { onConflict: 'student_id,date' })
  check(error, '/attendance')

  revalidatePath('/attendance')
  redirect(`/attendance?class=${class_id}&date=${date}&saved=${rows.length}`)
}
