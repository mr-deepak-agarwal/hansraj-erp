import TimetableGrid from '@/components/TimetableGrid'
import { requireRole } from '@/lib/auth'
import { cls, DAY_NAMES } from '@/lib/util'
import { clearSlot, saveSlot } from './actions'

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; class?: string; teacher?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s, role, user } = await requireRole(['admin', 'teacher'])

  const [{ data: classes }, { data: subjects }, { data: periods }, { data: teachers }] = await Promise.all([
    s.from('classes').select('*').order('name').order('section'),
    s.from('subjects').select('*').order('name'),
    s.from('periods').select('*').order('period'),
    s.from('profiles').select('id, full_name').eq('role', 'teacher').eq('active', true).order('full_name'),
  ])

  // Teachers land on their own timetable; admin lands on a class.
  const view = sp.view === 'teacher' || (!sp.view && role === 'teacher') ? 'teacher' : 'class'
  const teacherId = sp.teacher || (role === 'teacher' ? user.id : '')

  let slots: any[] = []
  if (view === 'class' && sp.class) {
    const { data } = await s
      .from('timetable_slots')
      .select('*, subjects(name), profiles:teacher_id(full_name)')
      .eq('class_id', sp.class)
    slots = data ?? []
  } else if (view === 'teacher' && teacherId) {
    const { data } = await s
      .from('timetable_slots')
      .select('*, subjects(name), classes(name, section)')
      .eq('teacher_id', teacherId)
    slots = data ?? []
  }

  const classOptions = (classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{cls(c)}</option>)
  const teacherName = (teachers ?? []).find((t: any) => t.id === teacherId)?.full_name

  return (
    <>
      <h1>Timetable</h1>
      {sp.error && <p className="err">{sp.error}</p>}

      <form className="row" method="get">
        <label>
          View
          <select name="view" defaultValue={view}>
            <option value="class">By class</option>
            <option value="teacher">By teacher</option>
          </select>
        </label>
        <label>
          Class
          <select name="class" defaultValue={sp.class ?? ''}>
            <option value="">—</option>
            {classOptions}
          </select>
        </label>
        <label>
          Teacher
          <select name="teacher" defaultValue={teacherId}>
            <option value="">—</option>
            {(teachers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </label>
        <button className="sec">Show</button>
      </form>
      <p className="muted">Pick “By class” and a class, or “By teacher” and a teacher, then press Show.</p>

      {view === 'class' && !sp.class && <p className="muted">Choose a class to see its timetable.</p>}
      {view === 'teacher' && !teacherId && <p className="muted">Choose a teacher to see their timetable.</p>}

      {((view === 'class' && sp.class) || (view === 'teacher' && teacherId)) && (
        <>
          <h2>
            {view === 'class'
              ? `Class ${cls((classes ?? []).find((c: any) => c.id === sp.class))}`
              : teacherName ?? 'Teacher'}
          </h2>
          <TimetableGrid slots={slots} periods={periods ?? []} show={view === 'class' ? 'class' : 'teacher'} />
        </>
      )}

      {role === 'admin' && (
        <>
          <h2>Edit timetable</h2>
          <p className="muted">
            Saving a slot that already exists replaces it. A teacher cannot be given two classes in the same period.
          </p>
          <form action={saveSlot} className="row">
            <label>
              Class
              <select name="class_id" required defaultValue={sp.class ?? ''}>
                <option value="" disabled>Select…</option>
                {classOptions}
              </select>
            </label>
            <label>
              Day
              <select name="day" required defaultValue="1">
                {DAY_NAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </label>
            <label>
              Period
              <select name="period" required defaultValue="1">
                {(periods ?? []).map((p: any) => (
                  <option key={p.period} value={p.period}>{p.label ?? `Period ${p.period}`}</option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <select name="subject_id" required defaultValue="">
                <option value="" disabled>Select…</option>
                {(subjects ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>
              Teacher
              <select name="teacher_id" defaultValue="">
                <option value="">— none —</option>
                {(teachers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label>Room <input name="room" style={{ width: 90 }} /></label>
            <button>Save slot</button>
          </form>
          {!teachers?.length && (
            <p className="muted">No teacher logins yet. Create users with the “teacher” role on the Users page to assign them here.</p>
          )}

          <form action={clearSlot} className="row">
            <label>
              Class
              <select name="class_id" required defaultValue={sp.class ?? ''}>
                <option value="" disabled>Select…</option>
                {classOptions}
              </select>
            </label>
            <label>
              Day
              <select name="day" defaultValue="1">
                {DAY_NAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </label>
            <label>
              Period
              <select name="period" defaultValue="1">
                {(periods ?? []).map((p: any) => (
                  <option key={p.period} value={p.period}>{p.label ?? `Period ${p.period}`}</option>
                ))}
              </select>
            </label>
            <button className="danger">Clear slot</button>
          </form>
        </>
      )}
    </>
  )
}
