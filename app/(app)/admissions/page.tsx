import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { cls } from '@/lib/util'
import { addApplication, enrollApplication, setApplicationStatus } from './actions'

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setApplicationStatus} style={{ display: 'inline' }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={status === 'rejected' ? 'danger' : 'sec'}>{label}</button>
    </form>
  )
}

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin'])
  const [{ data: classes }, { data: apps }] = await Promise.all([
    s.from('classes').select('*').order('name').order('section'),
    s
      .from('admissions')
      .select('*, classes:applying_class_id(name, section)')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return (
    <>
      <h1>Admissions</h1>
      <p className="muted">Applications move: pending → accepted → enrolled (a student record is created).</p>
      {sp.error && <p className="err">{sp.error}</p>}

      <table className="tbl">
        <thead>
          <tr><th>Applicant</th><th>Class</th><th>Guardian</th><th>Phone</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {(apps ?? []).map((a: any) => (
            <tr key={a.id}>
              <td>{a.applicant_name}{a.notes && <div className="muted" style={{ fontSize: 12 }}>{a.notes}</div>}</td>
              <td>{cls(a.classes)}</td>
              <td>{a.guardian_name ?? '—'}</td>
              <td>{a.guardian_phone ?? '—'}</td>
              <td><span className="tag">{a.status}</span></td>
              <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {a.status === 'pending' && (
                  <>
                    <StatusButton id={a.id} status="accepted" label="Accept" />
                    <StatusButton id={a.id} status="rejected" label="Reject" />
                  </>
                )}
                {a.status === 'accepted' && (
                  <form action={enrollApplication}>
                    <input type="hidden" name="id" value={a.id} />
                    <button>Enrol as student</button>
                  </form>
                )}
                {a.status === 'rejected' && <StatusButton id={a.id} status="pending" label="Reopen" />}
                {a.status === 'enrolled' && a.student_id && <Link href={`/students/${a.student_id}`}>View student</Link>}
              </td>
            </tr>
          ))}
          {!apps?.length && <tr><td colSpan={6} className="muted">No applications yet.</td></tr>}
        </tbody>
      </table>

      <h2>New application</h2>
      <form action={addApplication} className="row">
        <label>Applicant name <input name="applicant_name" required /></label>
        <label>Date of birth <input name="dob" type="date" /></label>
        <label>
          Gender
          <select name="gender" defaultValue="">
            <option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
          </select>
        </label>
        <label>
          Applying for class
          <select name="applying_class_id" defaultValue="">
            <option value="">—</option>
            {(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{cls(c)}</option>)}
          </select>
        </label>
        <label>Guardian <input name="guardian_name" /></label>
        <label>Phone <input name="guardian_phone" inputMode="tel" /></label>
        <label>Notes <input name="notes" placeholder="Previous school, siblings…" /></label>
        <button>Save application</button>
      </form>
    </>
  )
}
