'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, daysBetween, fail, FINE_PER_DAY, today, val } from '@/lib/util'

export async function addBook(fd: FormData) {
  const title = val(fd, 'title')
  const copies = Number(val(fd, 'copies') ?? 1)
  if (!title) fail('/library', 'Title is required')
  if (!Number.isInteger(copies) || copies < 1) fail('/library', 'Copies must be a whole number, at least 1')
  const { supabase: s } = await requireRole(['admin', 'teacher'])
  const { error } = await s.from('books').insert({
    title,
    author: val(fd, 'author'),
    isbn: val(fd, 'isbn'),
    category: val(fd, 'category'),
    copies,
  })
  check(error, '/library')
  revalidatePath('/library')
  redirect('/library')
}

export async function issueBook(fd: FormData) {
  const book_id = val(fd, 'book_id')
  const adm = val(fd, 'admission_no')?.toUpperCase()
  const due_on = val(fd, 'due_on')
  if (!book_id || !adm || !due_on) fail('/library', 'Book, admission number and due date are required')

  const issued_on = today()
  if (due_on < issued_on) fail('/library', 'Due date cannot be in the past')

  const { supabase: s } = await requireRole(['admin', 'teacher'])
  const { data: st, error: e1 } = await s
    .from('students')
    .select('id, status')
    .eq('admission_no', adm)
    .maybeSingle()
  check(e1, '/library')
  if (!st) fail('/library', `No student with admission number ${adm}`)
  if (st.status !== 'active') fail('/library', 'That student is no longer active')

  // The database refuses to lend more copies than exist, even if two people click at once.
  const { error } = await s.from('loans').insert({ book_id, student_id: st.id, issued_on, due_on })
  check(error, '/library')

  revalidatePath('/library')
  revalidatePath('/library/loans')
  redirect('/library/loans?issued=1')
}

export async function returnBook(fd: FormData) {
  const id = val(fd, 'id')
  if (!id) fail('/library/loans', 'Invalid request')
  const { supabase: s } = await requireRole(['admin', 'teacher'])

  const { data: loan, error: e1 } = await s
    .from('loans')
    .select('due_on, returned_on')
    .eq('id', id)
    .maybeSingle()
  check(e1, '/library/loans')
  if (!loan) fail('/library/loans', 'Loan not found')
  if (loan.returned_on) fail('/library/loans', 'Already returned')

  const t = today()
  const late = Math.max(0, daysBetween(loan.due_on, t))
  const { error } = await s
    .from('loans')
    .update({ returned_on: t, fine: late * FINE_PER_DAY })
    .eq('id', id)
    .is('returned_on', null)
  check(error, '/library/loans')

  revalidatePath('/library')
  revalidatePath('/library/loans')
  redirect('/library/loans?returned=1')
}
