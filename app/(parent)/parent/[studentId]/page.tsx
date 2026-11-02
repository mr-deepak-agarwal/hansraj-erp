import Link from 'next/link'
import { notFound } from 'next/navigation'
import TimetableGrid from '@/components/TimetableGrid'
import { requireRole } from '@/lib/auth'
import { cls, daysBetween, FINE_PER_DAY, grade, inr, today } from '@/lib/util'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export default async function ChildPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const { supabase: s } = await requireRole(['parent'])
  const t = today()

  // RLS returns nothing unless this child is linked to the signed-in parent.
  const { data: st } = await s
    .from('students')
    .select('id, full_name, admission_no, dob, guardian_name, class_id, classes(name, section)')
    .eq('id', studentId)
    .maybeSingle()
  if (!st) notFound()

  const [att, inv, mk, periods, loans] = await Promise.all([
    s.from('attendance').select('date, status').eq('student_id', studentId).order('date', { ascending: false }).limit(400),
    s.from('fee_invoice_balances').select('*').eq('student_id', studentId).order('due_date'),
    s
      .from('marks')
      .select('marks_obtained, exam_id, exams(name, max_marks, term, created_at), subjects(name)')
      .eq('student_id', studentId),
    s.from('periods').select('*').order('period'),
    s
      .from('loans')
      .select('id, issued_on, due_on, returned_on, fine, books(title, author)')
      .eq('student_id', studentId)
      .order('issued_on', { ascending: false })
      .limit(50),
  ])

  const invoices = inv.data ?? []
  const invoiceIds = invoices.map((i: any) => i.id)
  const [{ data: payments }, { data: slots }] = await Promise.all([
    invoiceIds.length
      ? s
          .from('fee_payments')
          .select('id, amount, paid_on, mode, receipt_no, fee_invoices(title)')
          .in('invoice_id', invoiceIds)
          .order('paid_on', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    st.class_id
      ? s.from('timetable_slots').select('*, subjects(name)').eq('class_id', st.class_id)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const days = att.data ?? []
  const present = days.filter((a: any) => a.status !== 'absent').length
  const outstanding = invoices.reduce((sum: number, i: any) => sum + Number(i.balance), 0)

  type ExamBlock = { name: string; term: string | null; max: number; created: string; rows: { subject: string; got: number }[] }
  const exams = new Map<string, ExamBlock>()
  for (const m of mk.data ?? []) {
    const ex = one((m as any).exams)
    const blk: ExamBlock = exams.get((m as any).exam_id) ?? {
      name: ex?.name ?? 'Exam', term: ex?.term ?? null, max: Number(ex?.max_marks ?? 0), created: ex?.created_at ?? '', rows: [],
    }
    blk.rows.push({ subject: one((m as any).subjects)?.name ?? '—', got: Number((m as any).marks_obtained) })
    exams.set((m as any).exam_id, blk)
  }
  const examList = [...exams.entries()].sort((a, b) => b[1].created.localeCompare(a[1].created))

  return (
    <>
      <p><Link href="/parent">← All children</Link></p>
      <h1>{st.full_name} <span className="tag">{st.admission_no}</span></h1>
      <p className="muted">Class {cls(st.classes)}</p>

      <div className="grid">
        <div className="card">
          <div className="l">Attendance</div>
          <div className="n">{days.length ? `${Math.round((present / days.length) * 100)}%` : '—'}</div>
          <div className="l">{present} of {days.length} school days</div>
        </div>
        <div className="card">
          <div className="l">Fees due</div>
          <div className={`n ${outstanding > 0 ? 'bad' : 'good'}`}>{inr(outstanding)}</div>
          <div className="l">Please pay at the school office</div>
        </div>
      </div>

      <h2>Timetable</h2>
      <TimetableGrid slots={slots ?? []} periods={periods.data ?? []} show="class" />

      <h2>Results</h2>
      {!examList.length && <p className="muted">No results published yet.</p>}
      {examList.map(([id, e]) => {
        const rows = [...e.rows].sort((a, b) => a.subject.localeCompare(b.subject))
        const total = rows.reduce((x, r) => x + r.got, 0)
        const maxTotal = rows.length * e.max
        const pct = maxTotal ? (total / maxTotal) * 100 : 0
        return (
          <div key={id} style={{ marginBottom: 16 }}>
            <strong>{e.name}</strong>{e.term ? <span className="muted"> · {e.term}</span> : null}
            <table className="tbl" style={{ marginTop: 6 }}>
              <thead><tr><th>Subject</th><th className="r">Marks</th><th className="r">Out of</th><th>Grade</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.subject}>
                    <td>{r.subject}</td><td className="r">{r.got}</td><td className="r">{e.max}</td>
                    <td>{grade(e.max ? (r.got / e.max) * 100 : 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th>Total</th><th className="r">{total}</th><th className="r">{maxTotal}</th><th>{pct.toFixed(1)}% · {grade(pct)}</th></tr>
              </tfoot>
            </table>
          </div>
        )
      })}

      <h2>Fees</h2>
      <table className="tbl">
        <thead><tr><th>Fee</th><th>Due</th><th className="r">Amount</th><th className="r">Paid</th><th className="r">Balance</th></tr></thead>
        <tbody>
          {invoices.map((i: any) => (
            <tr key={i.id}>
              <td>{i.title}</td>
              <td className={Number(i.balance) > 0 && i.due_date < t ? 'bad' : ''}>
                {i.due_date}{Number(i.balance) > 0 && i.due_date < t && ' (overdue)'}
              </td>
              <td className="r">{inr(i.amount)}</td><td className="r">{inr(i.paid)}</td>
              <td className={`r ${Number(i.balance) > 0 ? 'bad' : ''}`}>{inr(i.balance)}</td>
            </tr>
          ))}
          {!invoices.length && <tr><td colSpan={5} className="muted">No fees yet.</td></tr>}
        </tbody>
      </table>
      {!!payments?.length && (
        <>
          <p style={{ margin: '14px 0 6px' }}><strong>Payments received</strong></p>
          <table className="tbl">
            <thead><tr><th>Receipt</th><th>Date</th><th>For</th><th>Mode</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.receipt_no}</td><td>{p.paid_on}</td><td>{one(p.fee_invoices)?.title ?? '—'}</td>
                  <td>{p.mode}</td><td className="r">{inr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Library</h2>
      <table className="tbl">
        <thead><tr><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th></tr></thead>
        <tbody>
          {(loans.data ?? []).map((l: any) => {
            const late = !l.returned_on && l.due_on < t ? daysBetween(l.due_on, t) : 0
            return (
              <tr key={l.id}>
                <td>{one(l.books)?.title ?? '—'}</td>
                <td>{l.issued_on}</td>
                <td className={late ? 'bad' : ''}>
                  {l.due_on}{late > 0 && ` (${late}d late, fine ${inr(late * FINE_PER_DAY)})`}
                </td>
                <td>
                  {l.returned_on ?? '—'}
                  {Number(l.fine) > 0 && <span className="bad"> · fine {inr(l.fine)}</span>}
                </td>
              </tr>
            )
          })}
          {!loans.data?.length && <tr><td colSpan={4} className="muted">No library books.</td></tr>}
        </tbody>
      </table>

      <h2>Recent attendance</h2>
      <table className="tbl">
        <thead><tr><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          {days.slice(0, 15).map((a: any) => (
            <tr key={a.date}>
              <td>{a.date}</td>
              <td className={a.status === 'absent' ? 'bad' : ''}>{a.status}</td>
            </tr>
          ))}
          {!days.length && <tr><td colSpan={2} className="muted">No attendance recorded yet.</td></tr>}
        </tbody>
      </table>
    </>
  )
}
