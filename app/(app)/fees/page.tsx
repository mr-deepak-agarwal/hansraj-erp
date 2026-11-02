import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { cls, inr, today } from '@/lib/util'
import { createInvoices, recordPayment } from './actions'

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; class?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin', 'accounts'])
  const t = today()
  const showAll = sp.view === 'all'

  const { data: classes } = await s.from('classes').select('*').order('name').order('section')

  let studentIds: string[] | null = null
  if (sp.class) {
    const { data } = await s.from('students').select('id').eq('class_id', sp.class)
    studentIds = (data ?? []).map((x: any) => x.id)
  }

  let q = s.from('fee_invoice_balances').select('*').order('due_date').limit(300)
  if (!showAll) q = q.gt('balance', 0)
  if (studentIds) q = q.in('student_id', studentIds)
  const { data: invoices } = await q

  const ids = [...new Set((invoices ?? []).map((i: any) => i.student_id))]
  const { data: studs } = await s
    .from('students')
    .select('id, full_name, admission_no, classes(name, section)')
    .in('id', ids)
  const byId = new Map<string, any>((studs ?? []).map((x: any) => [x.id, x]))

  const { data: payments } = await s
    .from('fee_payments')
    .select('id, amount, paid_on, mode, receipt_no, fee_invoices(title, students(full_name))')
    .order('created_at', { ascending: false })
    .limit(15)

  const totalDue = (invoices ?? []).reduce((sum: number, i: any) => sum + Number(i.balance), 0)

  return (
    <>
      <h1>Fees</h1>
      {sp.error && <p className="err">{sp.error}</p>}

      <form className="row" method="get">
        <label>
          Show
          <select name="view" defaultValue={sp.view ?? 'due'}>
            <option value="due">Outstanding only</option>
            <option value="all">All invoices</option>
          </select>
        </label>
        <label>
          Class
          <select name="class" defaultValue={sp.class ?? ''}>
            <option value="">All</option>
            {(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{cls(c)}</option>)}
          </select>
        </label>
        <button className="sec">Filter</button>
        <span className="muted">Outstanding in this list: <strong className="bad">{inr(totalDue)}</strong></span>
      </form>

      <table className="tbl">
        <thead>
          <tr>
            <th>Student</th><th>Class</th><th>Fee</th><th>Due</th>
            <th className="r">Amount</th><th className="r">Balance</th><th>Collect payment</th>
          </tr>
        </thead>
        <tbody>
          {(invoices ?? []).map((i: any) => {
            const st = byId.get(i.student_id)
            const overdue = Number(i.balance) > 0 && i.due_date < t
            return (
              <tr key={i.id}>
                <td><Link href={`/students/${i.student_id}`}>{st?.full_name ?? '—'}</Link></td>
                <td>{cls(st?.classes)}</td>
                <td>{i.title}</td>
                <td className={overdue ? 'bad' : ''}>{i.due_date}{overdue && ' (overdue)'}</td>
                <td className="r">{inr(i.amount)}</td>
                <td className="r">{inr(i.balance)}</td>
                <td>
                  {Number(i.balance) > 0 ? (
                    <form action={recordPayment} className="row" style={{ margin: 0 }}>
                      <input type="hidden" name="invoice_id" value={i.id} />
                      <input name="amount" type="number" step="0.01" min="0.01" max={i.balance}
                        defaultValue={i.balance} style={{ width: 90 }} required />
                      <select name="mode" defaultValue="cash">
                        <option value="cash">Cash</option><option value="upi">UPI</option>
                        <option value="card">Card</option><option value="bank">Bank</option>
                        <option value="cheque">Cheque</option>
                      </select>
                      <button>Receive</button>
                    </form>
                  ) : <span className="good">Paid</span>}
                </td>
              </tr>
            )
          })}
          {!invoices?.length && <tr><td colSpan={7} className="muted">Nothing here.</td></tr>}
        </tbody>
      </table>

      <h2>Create fees for a class</h2>
      <p className="muted">Adds one invoice for every active student in the class (e.g. “Term 1 tuition”).</p>
      <form action={createInvoices} className="row">
        <label>
          Class
          <select name="class_id" required defaultValue="">
            <option value="" disabled>Select…</option>
            {(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{cls(c)}</option>)}
          </select>
        </label>
        <label>Fee name <input name="title" required placeholder="Term 1 tuition" /></label>
        <label>Amount (₹) <input name="amount" type="number" min="1" step="0.01" required /></label>
        <label>Due date <input name="due_date" type="date" required /></label>
        <button>Create invoices</button>
      </form>

      <h2>Recent receipts</h2>
      <table className="tbl">
        <thead><tr><th>Receipt</th><th>Date</th><th>Student</th><th>Fee</th><th>Mode</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {(payments ?? []).map((p: any) => (
            <tr key={p.id}>
              <td><Link href={`/fees/receipt/${p.id}`}>{p.receipt_no}</Link></td>
              <td>{p.paid_on}</td>
              <td>{p.fee_invoices?.students?.full_name ?? '—'}</td>
              <td>{p.fee_invoices?.title ?? '—'}</td>
              <td>{p.mode}</td>
              <td className="r">{inr(p.amount)}</td>
            </tr>
          ))}
          {!payments?.length && <tr><td colSpan={6} className="muted">No payments yet.</td></tr>}
        </tbody>
      </table>
    </>
  )
}
