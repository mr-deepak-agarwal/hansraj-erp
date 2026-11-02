'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, val } from '@/lib/util'

export async function addStaff(fd: FormData) {
  const full_name = val(fd, 'full_name')
  if (!full_name) fail('/staff', 'Name is required')
  const { supabase: s } = await requireRole(['admin', 'hr'])
  const { error } = await s.from('staff_members').insert({
    full_name,
    designation: val(fd, 'designation'),
    department: val(fd, 'department'),
    phone: val(fd, 'phone'),
    email: val(fd, 'email'),
    joined_on: val(fd, 'joined_on'),
    notes: val(fd, 'notes'),
  })
  check(error, '/staff')
  revalidatePath('/staff')
  redirect('/staff')
}

export async function setStaffStatus(fd: FormData) {
  const id = val(fd, 'id')
  const status = val(fd, 'status')
  if (!id || (status !== 'active' && status !== 'left')) fail('/staff', 'Invalid request')
  const { supabase: s } = await requireRole(['admin', 'hr'])
  const { error } = await s.from('staff_members').update({ status }).eq('id', id)
  check(error, '/staff')
  revalidatePath('/staff')
  redirect('/staff')
}
