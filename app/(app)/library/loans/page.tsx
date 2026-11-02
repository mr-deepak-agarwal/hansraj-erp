import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { cls, daysBetween, FINE_PER_DAY, inr, today } from '@/lib/util'
import { returnBook } from '../actions'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string; returned?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin', 'teacher'])
  const t = today()

  const [{ data: open }, { data: done }] = await Promise.all([
    s
      .from('loans')
      .select('id, issued_on, due_on, books(title), students(full_name, admission_no, classes(name, section))')
      .is('returned_on', null)
      .order('due_on')
      .limit(500),
    s
      .from('loans')
      .select('id, issued_on, due_on, returned_on, fine, books(title), students(full_name, admission_no)')
      .not('returned_on', 'is', null)
      .order('returned_on', { ascending: false })
      .limit(20),
  ])

  const overdueCount = (open ?? []).filter((l: any) => l.due_on < t).length

  return (
    <>
      <p><Link href="/library">← Library</Link></p>
      <h1>Issued books</h1>
      {sp.error && <p className="err">{sp.error}</p>}
      {sp.issued && <p className="okmsg">Book issued.</p>}
      {sp.returned && <p className="okmsg">Book returned.</p>}
      <p className="muted">
        {(open ?? []).length} out · <span className={overdueCount ? 'bad' : ''}>{overdueCount} overdue</span> · late fine {inr(FINE_PER_DAY)} per day
      </p>

      <table className="tbl">
        <thead>
          <tr><th>Book</th><th>Student</th><th>Class</th><th>Issued</th><th>Due</th><th>Fine so far</th><th></th></tr>
        </thead>
        <tbody>
          {(open ?? []).map((l: any) => {
            const late = Math.max(0, daysBetween(l.due_on, t))
            const st = one(l.students)
            return (
              <tr key={l.id}>
                <td>{one(l.books)?.title ?? '—'}</td>
                <td>{st?.full_name} <span className="muted">({st?.admission_no})</span></td>
                <td>{cls(st?.classes)}</td>
                <td>{l.issued_on}</td>
                <td className={late ? 'bad' : ''}>{l.due_on}{late > 0 && ` (${late}d late)`}</td>
                <td>{late ? inr(late * FINE_PER_DAY) : '—'}</td>
                <td>
                  <form action={returnBook}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="sec">Mark returned</button>
                  </form>
                </td>
              </tr>
            )
          })}
          {!open?.length && <tr><td colSpan={7} className="muted">No books are currently issued.</td></tr>}
        </tbody>
      </table>

      <h2>Recently returned</h2>
      <table className="tbl">
        <thead><tr><th>Book</th><th>Student</th><th>Issued</th><th>Returned</th><th className="r">Fine</th></tr></thead>
        <tbody>
          {(done ?? []).map((l: any) => {
            const st = one(l.students)
            return (
              <tr key={l.id}>
                <td>{one(l.books)?.title ?? '—'}</td>
                <td>{st?.full_name} <span className="muted">({st?.admission_no})</span></td>
                <td>{l.issued_on}</td>
                <td>{l.returned_on}</td>
                <td className="r">{Number(l.fine) > 0 ? inr(l.fine) : '—'}</td>
              </tr>
            )
          })}
          {!done?.length && <tr><td colSpan={5} className="muted">Nothing returned yet.</td></tr>}
        </tbody>
      </table>
    </>
  )
}
