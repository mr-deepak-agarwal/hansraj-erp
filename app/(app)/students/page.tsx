import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { cls } from '@/lib/util'
import { addStudent } from './actions'

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s, role } = await requireRole(['admin', 'teacher', 'accounts'])
  const { data: classes } = await s.from('classes').select('*').order('name').order('section')

  let query = s
    .from('students')
    .select('*, classes(name, section)')
    .order('full_name')
    .limit(300)
  if (sp.q) {
    const q = sp.q.replace(/[,()%*]/g, ' ').trim()
    if (q) query = query.or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`)
  }
  if (sp.class) query = query.eq('class_id', sp.class)
  const { data: students } = await query

  const options = (classes ?? []).map((c: any) => (
    <option key={c.id} value={c.id}>{cls(c)}</option>
  ))

  return (
    <>
      <h1>Students</h1>
      {sp.error && <p className="err">{sp.error}</p>}

      <form className="row" method="get">
        <label>Search <input name="q" defaultValue={sp.q ?? ''} placeholder="Name or admission no." /></label>
        <label>
          Class
          <select name="class" defaultValue={sp.class ?? ''}>
            <option value="">All</option>
            {options}
          </select>
        </label>
        <button className="sec">Filter</button>
      </form>

      <table className="tbl">
        <thead>
          <tr><th>Adm. no</th><th>Name</th><th>Class</th><th>Guardian</th><th>Phone</th><th>Status</th></tr>
        </thead>
        <tbody>
          {(students ?? []).map((st: any) => (
            <tr key={st.id}>
              <td>{st.admission_no}</td>
              <td><Link href={`/students/${st.id}`}>{st.full_name}</Link></td>
              <td>{cls(st.classes)}</td>
              <td>{st.guardian_name ?? '—'}</td>
              <td>{st.guardian_phone ?? '—'}</td>
              <td>{st.status === 'active' ? 'Active' : <span className="muted">Left</span>}</td>
            </tr>
          ))}
          {!students?.length && <tr><td colSpan={6} className="muted">No students found.</td></tr>}
        </tbody>
      </table>

      {role === 'admin' && (
        <>
      <h2>Register a student</h2>
      <p className="muted">Direct registration. For new applicants use Admissions, which enrols them into here.</p>
      <form action={addStudent} className="row">
        <label>Full name <input name="full_name" required /></label>
        <label>Date of birth <input name="dob" type="date" /></label>
        <label>
          Gender
          <select name="gender" defaultValue="">
            <option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
          </select>
        </label>
        <label>
          Class
          <select name="class_id" defaultValue="">
            <option value="">—</option>
            {options}
          </select>
        </label>
        <label>Guardian <input name="guardian_name" /></label>
        <label>Phone <input name="guardian_phone" inputMode="tel" /></label>
        <label>Address <input name="address" /></label>
        <button>Register</button>
      </form>
        </>
      )}
    </>
  )
}
