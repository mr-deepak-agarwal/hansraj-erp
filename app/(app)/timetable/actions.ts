'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, val } from '@/lib/util'

export async function saveSlot(fd: FormData) {
  const class_id = val(fd, 'class_id')
  const day = Number(val(fd, 'day'))
  const period = Number(val(fd, 'period'))
  const subject_id = val(fd, 'subject_id')
  const teacher_id = val(fd, 'teacher_id')
  const back = `/timetable?view=class&class=${class_id ?? ''}`

  if (!class_id || !subject_id) fail(back, 'Class and subject are required')
  if (!Number.isInteger(day) || day < 1 || day > 6) fail(back, 'Pick a day')
  if (!Number.isInteger(period)) fail(back, 'Pick a period')

  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s
    .from('timetable_slots')
    .upsert(
      { class_id, day, period, subject_id, teacher_id, room: val(fd, 'room') },
      { onConflict: 'class_id,day,period' }
    )
  if (error) {
    fail(
      back,
      error.message.includes('tt_teacher_unique')
        ? 'That teacher is already teaching another class in that period'
        : error.message
    )
  }
  revalidatePath('/timetable')
  redirect(back)
}

export async function clearSlot(fd: FormData) {
  const class_id = val(fd, 'class_id')
  const day = Number(val(fd, 'day'))
  const period = Number(val(fd, 'period'))
  const back = `/timetable?view=class&class=${class_id ?? ''}`
  if (!class_id || !Number.isInteger(day) || !Number.isInteger(period)) fail(back, 'Pick a class, day and period')

  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s
    .from('timetable_slots')
    .delete()
    .eq('class_id', class_id)
    .eq('day', day)
    .eq('period', period)
  check(error, back)
  revalidatePath('/timetable')
  redirect(back)
}
