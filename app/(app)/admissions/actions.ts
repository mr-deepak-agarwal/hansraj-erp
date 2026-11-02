'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, val } from '@/lib/util'

export async function addApplication(fd: FormData) {
  const applicant_name = val(fd, 'applicant_name')
  if (!applicant_name) fail('/admissions', 'Applicant name is required')
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s.from('admissions').insert({
    applicant_name,
    dob: val(fd, 'dob'),
    gender: val(fd, 'gender'),
    applying_class_id: val(fd, 'applying_class_id'),
    guardian_name: val(fd, 'guardian_name'),
    guardian_phone: val(fd, 'guardian_phone'),
    notes: val(fd, 'notes'),
  })
  check(error, '/admissions')
  revalidatePath('/admissions')
  redirect('/admissions')
}

export async function setApplicationStatus(fd: FormData) {
  const id = val(fd, 'id')
  const status = val(fd, 'status')
  if (!id || (status !== 'accepted' && status !== 'rejected' && status !== 'pending')) {
    fail('/admissions', 'Invalid request')
  }
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s.from('admissions').update({ status }).eq('id', id)
  check(error, '/admissions')
  revalidatePath('/admissions')
  redirect('/admissions')
}

/** Turns an accepted application into a registered student. */
export async function enrollApplication(fd: FormData) {
  const id = val(fd, 'id')
  if (!id) fail('/admissions', 'Invalid request')
  const { supabase: s } = await requireRole(['admin'])

  const { data: app, error: e1 } = await s.from('admissions').select('*').eq('id', id).single()
  check(e1, '/admissions')
  if (!app) fail('/admissions', 'Application not found')
  if (app.status === 'enrolled') fail('/admissions', 'Already enrolled')

  const { data: student, error: e2 } = await s
    .from('students')
    .insert({
      full_name: app.applicant_name,
      dob: app.dob,
      gender: app.gender,
      class_id: app.applying_class_id,
      guardian_name: app.guardian_name,
      guardian_phone: app.guardian_phone,
    })
    .select('id')
    .single()
  check(e2, '/admissions')
  if (!student) fail('/admissions', 'Could not create the student')

  const { error: e3 } = await s
    .from('admissions')
    .update({ status: 'enrolled', student_id: student.id })
    .eq('id', id)
  check(e3, '/admissions')

  revalidatePath('/admissions')
  revalidatePath('/students')
  redirect(`/students/${student.id}`)
}
