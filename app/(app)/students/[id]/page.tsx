import Link from 'next/link'
import { notFound } from 'next/navigation'
import AiBox from '@/components/AiBox'
import { requireRole } from '@/lib/auth'
import { cls, grade, inr } from '@/lib/util'
import { setStudentStatus } from '../actions'
import { linkParent, unlinkParent } from '../../users/actions'

export default async function StudentProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const { supabase: s, role } = await requireRole(['admin', 'teacher', 'accounts'])
  const canFees = role === 'admin' || role === 'accounts'
  const canAcademic = role === 'admin' || role === 'teacher'

  const { data: st } = await s.from('students').select('*, classes(name, section)').eq('id', id).maybeSingle()
  if (!st) notFound()

  const none = { data: [] as any[] }
  const [att, inv, mk, links, parents] = await Promise.all([
    canAcademic ? s.from('attendance').select('status').eq('student_id', id) : none,
    canFees ? s.from('fee_invoice_balances').select('*').eq('student_id', id).order('due_date') : none,
    canAcademic
      ? s.from('marks').select('marks_obtained, exam_id, exams(name, max_marks)').eq('student_id', id)
      : none,
    role === 'admin'
      ? s.from('parent_students').select('parent_id, profiles(full_name, email)').eq('student_id', id)
      : none,
    role === 'admin' ? s.from('profiles').select('id, full_name, email').eq('role', 'parent').eq('active', true).order('full_name') : none,
  ])

  const days = att.data ?? []
  const presentDays = days.filter((a: any) => a.status !== 'absent').length
  const invoices = inv.data ?? []
  const outstanding = invoices.reduce((sum: number, i: any) => sum + Number(i.balance), 0)

  const exams = new Map<string, { name: string; got: number; max: number }>()
  for (const m of mk.data ?? []) {
    const e: any = m
    const ex = Array.isArray(e.exams) ? e.exams[0] : e.exams
    const cur = exams.get(e.exam_id) ?? { name: ex?.name ?? 'Exam', got: 0, max: 0 }
    cur.got += Number(e.marks_obtained)
    cur.max += Number(ex?.max_marks ?? 0)
    exams.set(e.exam_id, cur)
  }

  const linkedIds = new Set((links.data ?? []).map((l: any) => l.parent_id))

  return (
    <>
      <p className="no-print"><Link href="/students">← Students</Link></p>
      <h1>{st.full_name} <span className="tag">{st.admission_no}</span></h1>
      {sp.error && <p className="err">{sp.error}</p>}

      <div className="grid">
        <div className="card"><div className="l">Class</div><div className="n">{cls(st.classes)}</div></div>
        {canAcademic && (
          <div className="card">
            <div className="l">Attendance</div>
            <div className="n">{days.length ? `${Math.round((presentDays / days.length) * 100)}%` : '—'}</div>
            <div className="l">{presentDays} of {days.length} days</div>
          </div>
        )}
        {canFees && (
          <div className="card"><div className="l">Fees outstanding</div><div className={`n ${outstanding > 0 ? 'bad' : 'good'}`}>{inr(outstanding)}</div></div>
        )}
      </div>

      <h2>Details</h2>
      <table className="tbl">
        <tbody>
          <tr><th>Date of birth</th><td>{st.dob ?? '—'}</td><th>Gender</th><td>{st.gender ?? '—'}</td></tr>
          <tr><th>Guardian</th><td>{st.guardian_name ?? '—'}</td><th>Phone</th><td>{st.guardian_phone ?? '—'}</td></tr>
          <tr><th>Address</th><td colSpan={3}>{st.address ?? '—'}</td></tr>
          <tr><th>Status</th><td colSpan={3}>
            {st.status}{' '}
            {role === 'admin' && (
              <form action={setStudentStatus} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={st.id} />
                <input type="hidden" name="status" value={st.status === 'active' ? 'left' : 'active'} />
                <button className="sec">{st.status === 'active' ? 'Mark as left' : 'Re-activate'}</button>
              </form>
            )}
          </td></tr>
        </tbody>
      </table>

      {role === 'admin' && (
        <>
          <h2>Parent logins</h2>
          <p className="muted">
            Parents who can sign in and see this student. One parent can be linked to several children.
            Create parent accounts on the <Link href="/users">Users</Link> page.
          </p>
          <table className="tbl">
            <thead><tr><th>Parent</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {(links.data ?? []).map((l: any) => {
                const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
                return (
                  <tr key={l.parent_id}>
                    <td>{p?.full_name ?? '—'}</td>
                    <td>{p?.email ?? '—'}</td>
                    <td>
                      <form action={unlinkParent}>
                        <input type="hidden" name="parent_id" value={l.parent_id} />
                        <input type="hidden" name="student_id" value={st.id} />
                        <input type="hidden" name="back" value={`/students/${st.id}`} />
                        <button className="danger">Unlink</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
              {!links.data?.length && <tr><td colSpan={3} className="muted">No parent login linked yet.</td></tr>}
            </tbody>
          </table>
          <form action={linkParent} className="row">
            <input type="hidden" name="student_id" value={st.id} />
            <input type="hidden" name="back" value={`/students/${st.id}`} />
            <label>
              Link an existing parent
              <select name="parent_id" required defaultValue="">
                <option value="" disabled>Select parent…</option>
                {(parents.data ?? []).filter((p: any) => !linkedIds.has(p.id)).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                ))}
              </select>
            </label>
            <button className="sec">Link</button>
          </form>
        </>
      )}

      {canFees && (
        <>
          <h2>Fees</h2>
          <table className="tbl">
            <thead><tr><th>Fee</th><th>Due</th><th className="r">Amount</th><th className="r">Paid</th><th className="r">Balance</th></tr></thead>
            <tbody>
              {invoices.map((i: any) => (
                <tr key={i.id}>
                  <td>{i.title}</td><td>{i.due_date}</td>
                  <td className="r">{inr(i.amount)}</td><td className="r">{inr(i.paid)}</td>
                  <td className={`r ${Number(i.balance) > 0 ? 'bad' : ''}`}>{inr(i.balance)}</td>
                </tr>
              ))}
              {!invoices.length && <tr><td colSpan={5} className="muted">No fees yet.</td></tr>}
            </tbody>
          </table>
          {outstanding > 0 && (
            <AiBox params={{ kind: 'reminder', studentId: st.id }} label="Draft fee reminder for guardian" />
          )}
        </>
      )}

      {canAcademic && (
        <>
          <h2>Marks</h2>
          <table className="tbl">
            <thead><tr><th>Exam</th><th className="r">Total</th><th className="r">%</th><th>Grade</th><th></th></tr></thead>
            <tbody>
              {[...exams.entries()].map(([examId, e]) => {
                const pct = e.max ? (e.got / e.max) * 100 : 0
                return (
                  <tr key={examId}>
                    <td>{e.name}</td>
                    <td className="r">{e.got} / {e.max}</td>
                    <td className="r">{pct.toFixed(1)}</td>
                    <td>{grade(pct)}</td>
                    <td><Link href={`/marks/report/${st.id}?exam=${examId}`}>Report card</Link></td>
                  </tr>
                )
              })}
              {!exams.size && <tr><td colSpan={5} className="muted">No marks entered yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
