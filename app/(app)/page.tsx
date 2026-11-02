import Link from 'next/link'
import { redirect } from 'next/navigation'
import AiBox from '@/components/AiBox'
import { requireRole, STAFF_ROLES } from '@/lib/auth'
import { cls, inr, today } from '@/lib/util'

type Db = Awaited<ReturnType<typeof requireRole>>['supabase']

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s, role, name, user } = await requireRole(STAFF_ROLES)
  if ((role as string) === 'parent') redirect('/parent')
  const t = today()

  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">Hello, {name}. You are signed in as <strong>{role}</strong>.</p>
      {sp.error && <p className="err">{sp.error}</p>}
      {role === 'admin' && <AdminHome s={s} t={t} />}
      {role === 'accounts' && <AccountsHome s={s} t={t} />}
      {role === 'teacher' && <TeacherHome s={s} t={t} userId={user.id} />}
      {role === 'hr' && <HrHome s={s} />}
    </>
  )
}

async function AdminHome({ s, t }: { s: Db; t: string }) {
  const [students, att, fees, apps] = await Promise.all([
    s.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('attendance').select('status').eq('date', t),
    s.from('fee_summary').select('*').single(),
    s.from('admissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  if (students.error) {
    return (
      <p className="err">
        Database not ready: {students.error.message}. Run <code>supabase/schema.sql</code> in the
        Supabase SQL Editor, then reload.
      </p>
    )
  }

  const marked = att.data ?? []
  const present = marked.filter((a: any) => a.status !== 'absent').length
  const billed = Number(fees.data?.billed ?? 0)
  const collected = Number(fees.data?.collected ?? 0)

  return (
    <>
      <div className="grid">
        <div className="card"><div className="n">{students.count ?? 0}</div><div className="l">Active students</div></div>
        <div className="card">
          <div className="n">{marked.length ? `${Math.round((present / marked.length) * 100)}%` : '—'}</div>
          <div className="l">Present today ({marked.length} marked)</div>
        </div>
        <div className="card"><div className="n">{inr(collected)}</div><div className="l">Fees collected</div></div>
        <div className="card"><div className="n bad">{inr(billed - collected)}</div><div className="l">Fees outstanding</div></div>
        <div className="card"><div className="n">{apps.count ?? 0}</div><div className="l"><Link href="/admissions">Pending applications</Link></div></div>
      </div>

      <h2>AI insights</h2>
      <p className="muted">A short summary of attendance, fees and admissions with suggested actions.</p>
      <AiBox params={{ kind: 'insights' }} label="Generate insights" />
    </>
  )
}

async function AccountsHome({ s, t }: { s: Db; t: string }) {
  const [fees, overdue] = await Promise.all([
    s.from('fee_summary').select('*').single(),
    s.from('fee_invoice_balances').select('balance').lt('due_date', t).gt('balance', 0).limit(5000),
  ])
  if (fees.error) return <p className="err">Database not ready: {fees.error.message}</p>

  const billed = Number(fees.data?.billed ?? 0)
  const collected = Number(fees.data?.collected ?? 0)
  const od = overdue.data ?? []
  const odAmount = od.reduce((sum: number, r: any) => sum + Number(r.balance), 0)

  return (
    <>
      <div className="grid">
        <div className="card"><div className="n">{inr(collected)}</div><div className="l">Collected</div></div>
        <div className="card"><div className="n bad">{inr(billed - collected)}</div><div className="l">Outstanding</div></div>
        <div className="card"><div className="n bad">{od.length}</div><div className="l">Overdue invoices ({inr(odAmount)})</div></div>
      </div>
      <p><Link href="/fees">Open Fees →</Link></p>
    </>
  )
}

async function TeacherHome({ s, t, userId }: { s: Db; t: string; userId: string }) {
  // 0 = Sunday ... 6 = Saturday; the timetable uses 1..6 for Mon..Sat.
  const dow = new Date(`${t}T00:00:00Z`).getUTCDay()
  const [slots, periods] = await Promise.all([
    dow === 0
      ? Promise.resolve({ data: [] as any[], error: null })
      : s
          .from('timetable_slots')
          .select('period, room, subjects(name), classes(name, section)')
          .eq('teacher_id', userId)
          .eq('day', dow)
          .order('period'),
    s.from('periods').select('*'),
  ])
  const pmap = new Map<number, any>((periods.data ?? []).map((p: any) => [p.period, p]))

  return (
    <>
      <h2>My classes today</h2>
      {dow === 0 ? (
        <p className="muted">It is Sunday. No classes.</p>
      ) : (
        <table className="tbl">
          <thead><tr><th>Period</th><th>Time</th><th>Class</th><th>Subject</th><th>Room</th></tr></thead>
          <tbody>
            {(slots.data ?? []).map((x: any) => {
              const p = pmap.get(x.period)
              const one = (v: any) => (Array.isArray(v) ? v[0] : v)
              return (
                <tr key={x.period}>
                  <td>{p?.label ?? x.period}</td>
                  <td>{p ? `${String(p.start_time).slice(0, 5)}–${String(p.end_time).slice(0, 5)}` : '—'}</td>
                  <td>{cls(x.classes)}</td>
                  <td>{one(x.subjects)?.name ?? '—'}</td>
                  <td>{x.room ?? '—'}</td>
                </tr>
              )
            })}
            {!slots.data?.length && <tr><td colSpan={5} className="muted">No classes assigned to you today.</td></tr>}
          </tbody>
        </table>
      )}
      <p>
        <Link href="/attendance">Take attendance</Link> · <Link href="/marks">Enter marks</Link> ·{' '}
        <Link href="/timetable">Full timetable</Link> · <Link href="/library">Library</Link>
      </p>
    </>
  )
}

async function HrHome({ s }: { s: Db }) {
  const [active, left] = await Promise.all([
    s.from('staff_members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('staff_members').select('*', { count: 'exact', head: true }).eq('status', 'left'),
  ])
  if (active.error) return <p className="err">Database not ready: {active.error.message}</p>
  return (
    <>
      <div className="grid">
        <div className="card"><div className="n">{active.count ?? 0}</div><div className="l">Active staff</div></div>
        <div className="card"><div className="n">{left.count ?? 0}</div><div className="l">Former staff</div></div>
      </div>
      <p><Link href="/staff">Open Staff directory →</Link></p>
    </>
  )
}
