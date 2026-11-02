import { requireRole } from '@/lib/auth'
import { cls } from '@/lib/util'
import { addClass, addExam, addSubject, savePeriod } from './actions'

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin'])
  const [classes, subjects, exams, periods] = await Promise.all([
    s.from('classes').select('*').order('name').order('section'),
    s.from('subjects').select('*').order('name'),
    s.from('exams').select('*').order('created_at', { ascending: false }),
    s.from('periods').select('*').order('period'),
  ])

  return (
    <>
      <h1>Setup</h1>
      <p className="muted">Create classes, subjects and exams once. Everything else uses them.</p>
      {sp.error && <p className="err">{sp.error}</p>}

      <h2>Classes</h2>
      <form action={addClass} className="row">
        <label>Class <input name="name" required placeholder="e.g. 5" /></label>
        <label>Section <input name="section" placeholder="e.g. A" /></label>
        <button>Add class</button>
      </form>
      <p>{(classes.data ?? []).map((c: any) => <span key={c.id} className="tag" style={{ marginRight: 6 }}>{cls(c)}</span>)}</p>

      <h2>Subjects</h2>
      <form action={addSubject} className="row">
        <label>Subject <input name="name" required placeholder="e.g. Mathematics" /></label>
        <button>Add subject</button>
      </form>
      <p>{(subjects.data ?? []).map((x: any) => <span key={x.id} className="tag" style={{ marginRight: 6 }}>{x.name}</span>)}</p>

      <h2>Exams</h2>
      <form action={addExam} className="row">
        <label>Exam name <input name="name" required placeholder="e.g. Half Yearly" /></label>
        <label>Term <input name="term" placeholder="e.g. Term 1" /></label>
        <label>Max marks <input name="max_marks" type="number" min="1" defaultValue={100} required /></label>
        <button>Add exam</button>
      </form>
      <table className="tbl">
        <thead><tr><th>Exam</th><th>Term</th><th className="r">Max marks</th></tr></thead>
        <tbody>
          {(exams.data ?? []).map((e: any) => (
            <tr key={e.id}><td>{e.name}</td><td>{e.term ?? '—'}</td><td className="r">{e.max_marks}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Period timings</h2>
      <p className="muted">Used by the timetable. Saving an existing period number updates its times.</p>
      <form action={savePeriod} className="row">
        <label>Period no. <input name="period" type="number" min="1" max="12" required style={{ width: 80 }} /></label>
        <label>Label <input name="label" placeholder="Period 1" /></label>
        <label>Start <input name="start_time" type="time" required /></label>
        <label>End <input name="end_time" type="time" required /></label>
        <button>Save period</button>
      </form>
      <table className="tbl">
        <thead><tr><th>Period</th><th>Label</th><th>Start</th><th>End</th></tr></thead>
        <tbody>
          {(periods.data ?? []).map((p: any) => (
            <tr key={p.period}>
              <td>{p.period}</td><td>{p.label}</td>
              <td>{String(p.start_time).slice(0, 5)}</td><td>{String(p.end_time).slice(0, 5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
