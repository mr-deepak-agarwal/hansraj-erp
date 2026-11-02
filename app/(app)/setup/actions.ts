'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, val } from '@/lib/util'

export async function addClass(fd: FormData) {
  const name = val(fd, 'name')
  if (!name) fail('/setup', 'Class name is required')
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s.from('classes').insert({ name, section: val(fd, 'section') })
  check(error, '/setup')
  revalidatePath('/setup')
  redirect('/setup')
}

export async function addSubject(fd: FormData) {
  const name = val(fd, 'name')
  if (!name) fail('/setup', 'Subject name is required')
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s.from('subjects').insert({ name })
  check(error, '/setup')
  revalidatePath('/setup')
  redirect('/setup')
}

export async function addExam(fd: FormData) {
  const name = val(fd, 'name')
  const max = Number(val(fd, 'max_marks') ?? 100)
  if (!name) fail('/setup', 'Exam name is required')
  if (!(max > 0)) fail('/setup', 'Maximum marks must be more than 0')
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s.from('exams').insert({ name, term: val(fd, 'term'), max_marks: max })
  check(error, '/setup')
  revalidatePath('/setup')
  redirect('/setup')
}

export async function savePeriod(fd: FormData) {
  const period = Number(val(fd, 'period'))
  const start = val(fd, 'start_time')
  const end = val(fd, 'end_time')
  if (!Number.isInteger(period) || period < 1 || period > 12) fail('/setup', 'Period must be between 1 and 12')
  if (!start || !end) fail('/setup', 'Start and end time are required')
  if (end <= start) fail('/setup', 'End time must be after start time')
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s
    .from('periods')
    .upsert({ period, label: val(fd, 'label') ?? `Period ${period}`, start_time: start, end_time: end })
  check(error, '/setup')
  revalidatePath('/setup')
  redirect('/setup')
}
