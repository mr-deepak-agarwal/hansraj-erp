'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, val } from '@/lib/util'

export async function saveMarks(fd: FormData) {
  const exam_id = val(fd, 'exam_id')
  const subject_id = val(fd, 'subject_id')
  const class_id = val(fd, 'class_id')
  if (!exam_id || !subject_id || !class_id) fail('/marks', 'Pick an exam, class and subject')
  const back = `/marks?exam=${exam_id}&class=${class_id}&subject=${subject_id}`

  const { supabase: s } = await requireRole(['admin', 'teacher'])
  const { data: exam, error: e1 } = await s.from('exams').select('max_marks').eq('id', exam_id).single()
  check(e1, back)
  if (!exam) fail(back, 'Exam not found')
  const max = Number(exam.max_marks)

  const rows: { exam_id: string; subject_id: string; student_id: string; marks_obtained: number }[] = []
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('m_')) continue
    const raw = String(value).trim()
    if (raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > max) fail(back, `Marks must be between 0 and ${max}`)
    rows.push({ exam_id, subject_id, student_id: key.slice(2), marks_obtained: n })
  }
  if (!rows.length) fail(back, 'No marks entered')

  const { error } = await s.from('marks').upsert(rows, { onConflict: 'exam_id,student_id,subject_id' })
  check(error, back)

  revalidatePath('/marks')
  redirect(`${back}&saved=${rows.length}`)
}
