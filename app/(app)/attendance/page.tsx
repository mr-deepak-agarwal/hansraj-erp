import { requireRole } from '@/lib/auth'
import { cls, today } from '@/lib/util'
import { saveAttendance } from './actions'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string; saved?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin', 'teacher'])
  const date = sp.date || today()
  const { data: classes } = await s.from('classes').select('*').order('name').order('section')

  let students: any[] = []
  const existing = new Map<string, string>()
  if (sp.class) {
    const { data } = await s
      .from('students')
      .select('id, full_name, admission_no')
      .eq('class_id', sp.class)
      .eq('status', 'active')
      .order('full_name')
    students = data ?? []
    if (students.length) {
      const { data: att } = await s
        .from('attendance')
        .select('student_id, status')
        .eq('date', date)
        .in('student_id', students.map((x) => x.id))
      for (const a of att ?? []) existing.set(a.student_id, a.status)
    }
  }

  return (
    <>
      <h1>Attendance</h1>
      {sp.error && <p className="err">{sp.error}</p>}
      {sp.saved && <p className="okmsg">Saved attendance for {sp.saved} students.</p>}

      <form className="row" method="get">
        <label>
          Class
          <select name="class" defaultValue={sp.class ?? ''} required>
            <option value="" disabled>Select…</option>
            {(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{cls(c)}</option>)}
          </select>
        </label>
        <label>Date <input name="date" type="date" defaultValue={date} max={today()} /></label>
        <button className="sec">Load</button>
      </form>

      {sp.class && !students.length && <p className="muted">No active students in this class.</p>}

      {students.length > 0 && (
        <form action={saveAttendance}>
          <input type="hidden" name="class_id" value={sp.class} />
          <input type="hidden" name="date" value={date} />
          <table className="tbl">
            <thead><tr><th>#</th><th>Adm. no</th><th>Student</th><th>Present</th><th>Absent</th><th>Late</th></tr></thead>
            <tbody>
              {students.map((st, idx) => {
                const cur = existing.get(st.id) ?? 'present'
                return (
                  <tr key={st.id}>
                    <td>{idx + 1}</td>
                    <td>{st.admission_no}</td>
                    <td>{st.full_name}</td>
                    {['present', 'absent', 'late'].map((v) => (
                      <td key={v}>
                        <input type="radio" name={`status_${st.id}`} value={v} defaultChecked={cur === v} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p><button>Save attendance for {date}</button></p>
        </form>
      )}
    </>
  )
}
