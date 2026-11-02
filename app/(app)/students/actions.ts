'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, val } from '@/lib/util'

export async function addStudent(fd: FormData) {
  const full_name = val(fd, 'full_name')
  if (!full_name) fail('/students', 'Student name is required')
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s.from('students').insert({
    full_name,
    dob: val(fd, 'dob'),
    gender: val(fd, 'gender'),
    class_id: val(fd, 'class_id'),
    guardian_name: val(fd, 'guardian_name'),
    guardian_phone: val(fd, 'guardian_phone'),
    address: val(fd, 'address'),
  })
  check(error, '/students')
  revalidatePath('/students')
  redirect('/students')
}

export async function setStudentStatus(fd: FormData) {
  const id = val(fd, 'id')
  const status = val(fd, 'status')
  if (!id || (status !== 'active' && status !== 'left')) fail('/students', 'Invalid request')
  const { supabase: s } = await requireRole(['admin'])
  const { error } = await s.from('students').update({ status }).eq('id', id)
  check(error, `/students/${id}`)
  revalidatePath(`/students/${id}`)
  redirect(`/students/${id}`)
}
