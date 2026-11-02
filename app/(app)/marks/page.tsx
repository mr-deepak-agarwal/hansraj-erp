import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { cls } from '@/lib/util'
import { saveMarks } from './actions'

export default async function MarksPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; class?: string; subject?: string; saved?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin', 'teacher'])

  const [{ data: exams }, { data: classes }, { data: subjects }] = await Promise.all([
    s.from('exams').select('*').order('created_at', { ascending: false }),
    s.from('classes').select('*').order('name').order('section'),
    s.from('subjects').select('*').order('name'),
  ])

  const exam = (exams ?? []).find((e: any) => e.id === sp.exam)
  let students: any[] = []
  const existing = new Map<string, number>()
  if (exam && sp.class && sp.subject) {
    const { data } = await s
      .from('students')
      .select('id, full_name, admission_no')
      .eq('class_id', sp.class)
      .eq('status', 'active')
      .order('full_name')
    students = data ?? []
    if (students.length) {
      const { data: m } = await s
        .from('marks')
        .select('student_id, marks_obtained')
        .eq('exam_id', exam.id)
        .eq('subject_id', sp.subject)
        .in('student_id', students.map((x) => x.id))
      for (const r of m ?? []) existing.set(r.student_id, Number(r.marks_obtained))
    }
  }

  return (
    <>
      <h1>Marks</h1>
      {sp.error && <p className="err">{sp.error}</p>}
      {sp.saved && <p className="okmsg">Saved marks for {sp.saved} students.</p>}

      <form className="row" method="get">
        <label>
          Exam
          <select name="exam" defaultValue={sp.exam ?? ''} required>
            <option value="" disabled>Select…</option>
            {(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name} (out of {e.max_marks})</option>)}
          </select>
        </label>
        <label>
          Class
          <select name="class" defaultValue={sp.class ?? ''} required>
            <option value="" disabled>Select…</option>
            {(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{cls(c)}</option>)}
          </select>
        </label>
        <label>
          Subject
          <select name="subject" defaultValue={sp.subject ?? ''} required>
            <option value="" disabled>Select…</option>
            {(subjects ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <button className="sec">Load</button>
      </form>

      {!exams?.length && <p className="muted">Create an exam and subjects in <Link href="/setup">Setup</Link> first.</p>}
      {exam && sp.class && !students.length && <p className="muted">No active students in this class.</p>}

      {exam && students.length > 0 && (
        <form action={saveMarks}>
          <input type="hidden" name="exam_id" value={exam.id} />
          <input type="hidden" name="class_id" value={sp.class} />
          <input type="hidden" name="subject_id" value={sp.subject} />
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Adm. no</th><th>Student</th><th>Marks (out of {exam.max_marks})</th><th></th></tr>
            </thead>
            <tbody>
              {students.map((st, idx) => (
                <tr key={st.id}>
                  <td>{idx + 1}</td>
                  <td>{st.admission_no}</td>
                  <td>{st.full_name}</td>
                  <td>
                    <input name={`m_${st.id}`} type="number" step="0.5" min="0" max={exam.max_marks}
                      defaultValue={existing.get(st.id) ?? ''} style={{ width: 90 }} />
                  </td>
                  <td><Link href={`/marks/report/${st.id}?exam=${exam.id}`}>Report card</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><button>Save marks</button></p>
        </form>
      )}
    </>
  )
}
