'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { check, fail, today, val } from '@/lib/util'

/** Creates one invoice per active student in the chosen class. */
export async function createInvoices(fd: FormData) {
  const class_id = val(fd, 'class_id')
  const title = val(fd, 'title')
  const amount = Number(val(fd, 'amount'))
  const due_date = val(fd, 'due_date')
  if (!class_id || !title || !due_date) fail('/fees', 'Class, fee name and due date are required')
  if (!(amount > 0)) fail('/fees', 'Amount must be more than 0')

  const { supabase: s } = await requireRole(['admin', 'accounts'])
  const { data: students, error: e1 } = await s
    .from('students')
    .select('id')
    .eq('class_id', class_id)
    .eq('status', 'active')
  check(e1, '/fees')
  if (!students?.length) fail('/fees', 'No active students in that class')

  const { error } = await s
    .from('fee_invoices')
    .insert(students.map((st: { id: string }) => ({ student_id: st.id, title, amount, due_date })))
  check(error, '/fees')

  revalidatePath('/fees')
  redirect('/fees')
}

export async function recordPayment(fd: FormData) {
  const invoice_id = val(fd, 'invoice_id')
  const amount = Number(val(fd, 'amount'))
  const mode = val(fd, 'mode') ?? 'cash'
  if (!invoice_id) fail('/fees', 'Invalid request')
  if (!(amount > 0)) fail('/fees', 'Payment must be more than 0')

  const { supabase: s } = await requireRole(['admin', 'accounts'])
  const { data: inv, error: e1 } = await s
    .from('fee_invoice_balances')
    .select('balance')
    .eq('id', invoice_id)
    .single()
  check(e1, '/fees')
  if (!inv) fail('/fees', 'Invoice not found')
  if (amount > Number(inv.balance)) fail('/fees', `Payment is more than the balance (${inv.balance})`)

  const { data: pay, error } = await s
    .from('fee_payments')
    .insert({ invoice_id, amount, mode, paid_on: today() })
    .select('id')
    .single()
  check(error, '/fees')
  if (!pay) fail('/fees', 'Could not record the payment')

  revalidatePath('/fees')
  redirect(`/fees/receipt/${pay.id}`)
}
