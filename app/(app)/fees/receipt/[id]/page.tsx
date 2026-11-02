import Link from 'next/link'
import { notFound } from 'next/navigation'
import PrintButton from '@/components/PrintButton'
import { requireRole } from '@/lib/auth'
import { cls, inr } from '@/lib/util'

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase: s } = await requireRole(['admin', 'accounts'])

  const { data: p } = await s
    .from('fee_payments')
    .select(
      '*, fee_invoices(id, title, amount, students(full_name, admission_no, guardian_name, classes(name, section)))'
    )
    .eq('id', id)
    .maybeSingle()
  if (!p) notFound()

  const inv = p.fee_invoices
  const st = inv?.students
  const { data: bal } = await s.from('fee_invoice_balances').select('balance').eq('id', inv.id).single()

  return (
    <>
      <p className="no-print"><Link href="/fees">← Fees</Link> <PrintButton label="Print receipt" /></p>
      <div className="receipt">
        <h1 style={{ marginTop: 0 }}>{process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School'} — Fee receipt</h1>
        <table className="tbl">
          <tbody>
            <tr><th>Receipt no.</th><td>{p.receipt_no}</td></tr>
            <tr><th>Date</th><td>{p.paid_on}</td></tr>
            <tr><th>Student</th><td>{st?.full_name} ({st?.admission_no})</td></tr>
            <tr><th>Class</th><td>{cls(st?.classes)}</td></tr>
            <tr><th>Guardian</th><td>{st?.guardian_name ?? '—'}</td></tr>
            <tr><th>Fee</th><td>{inv?.title} (total {inr(inv?.amount)})</td></tr>
            <tr><th>Mode</th><td>{p.mode}</td></tr>
            <tr><th>Amount received</th><td><strong>{inr(p.amount)}</strong></td></tr>
            <tr><th>Balance after this payment</th><td>{inr(bal?.balance)}</td></tr>
          </tbody>
        </table>
        <p className="muted">This is a computer-generated receipt.</p>
      </div>
    </>
  )
}
