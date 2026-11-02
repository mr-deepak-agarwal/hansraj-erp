import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { cls, inr } from '@/lib/util'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export default async function ParentHome() {
  const { supabase: s, name } = await requireRole(['parent'])

  // Row Level Security already limits these to this parent's own children.
  const { data: links } = await s
    .from('parent_students')
    .select('students(id, full_name, admission_no, status, classes(name, section))')
  const children = (links ?? []).map((l: any) => one(l.students)).filter(Boolean)
  const ids = children.map((c: any) => c.id)

  const [att, inv] = ids.length
    ? await Promise.all([
        s.from('attendance').select('student_id, status').in('student_id', ids).limit(20000),
        s.from('fee_invoice_balances').select('student_id, balance').in('student_id', ids),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  const stats = new Map<string, { days: number; present: number; due: number }>()
  for (const id of ids) stats.set(id, { days: 0, present: 0, due: 0 })
  for (const a of att.data ?? []) {
    const x = stats.get((a as any).student_id)!
    x.days++
    if ((a as any).status !== 'absent') x.present++
  }
  for (const i of inv.data ?? []) stats.get((i as any).student_id)!.due += Number((i as any).balance)

  return (
    <>
      <h1>Welcome, {name}</h1>
      {!children.length && (
        <p className="muted">
          No children are linked to your login yet. Please ask the school office to link your child.
        </p>
      )}
      <div className="grid">
        {children.map((c: any) => {
          const x = stats.get(c.id)!
          return (
            <div className="card" key={c.id}>
              <div className="n" style={{ fontSize: 18 }}>
                <Link href={`/parent/${c.id}`}>{c.full_name}</Link>
              </div>
              <div className="l">Class {cls(c.classes)} · {c.admission_no}</div>
              <p style={{ margin: '10px 0 0' }}>
                Attendance: <strong>{x.days ? `${Math.round((x.present / x.days) * 100)}%` : '—'}</strong>
                <br />
                Fees due: <strong className={x.due > 0 ? 'bad' : 'good'}>{inr(x.due)}</strong>
              </p>
              <p style={{ margin: '8px 0 0' }}><Link href={`/parent/${c.id}`}>View details →</Link></p>
            </div>
          )
        })}
      </div>
    </>
  )
}
