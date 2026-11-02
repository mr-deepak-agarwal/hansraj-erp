import { requireRole } from '@/lib/auth'
import { changeRole, createUser, linkParent, resetPassword, setActive, unlinkParent } from './actions'

const ROLES = ['admin', 'teacher', 'hr', 'accounts', 'parent']

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; reset?: string }>
}) {
  const sp = await searchParams
  const { supabase: s, user } = await requireRole(['admin'])

  const [{ data: profiles }, { data: links }] = await Promise.all([
    s.from('profiles').select('*').order('role').order('full_name'),
    s.from('parent_students').select('parent_id, student_id, students(full_name, admission_no)'),
  ])

  const kids = new Map<string, any[]>()
  for (const l of links ?? []) {
    const arr = kids.get((l as any).parent_id) ?? []
    arr.push(l)
    kids.set((l as any).parent_id, arr)
  }

  return (
    <>
      <h1>Users</h1>
      <p className="muted">
        Roles: <strong>admin</strong> (everything), <strong>teacher</strong> (attendance, marks, timetable, library),
        {' '}<strong>accounts</strong> (fees), <strong>hr</strong> (staff directory), <strong>parent</strong> (sees only their own children).
      </p>
      {sp.error && <p className="err">{sp.error}</p>}
      {sp.created && <p className="okmsg">Created {sp.created}. Share the password with them securely.</p>}
      {sp.reset && <p className="okmsg">Password updated.</p>}
      {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
        <p className="err">
          <code>SUPABASE_SERVICE_ROLE_KEY</code> is not set, so creating users and resetting passwords will fail.
          Add it to your environment variables (server only).
        </p>
      )}

      <table className="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Manage</th></tr></thead>
        <tbody>
          {(profiles ?? []).map((p: any) => {
            const me = p.id === user.id
            const children = kids.get(p.id) ?? []
            return (
              <tr key={p.id}>
                <td>
                  {p.full_name ?? '—'}
                  {p.role === 'parent' && (
                    <div style={{ fontSize: 12 }}>
                      {children.length === 0 && <span className="muted">No children linked</span>}
                      {children.map((c: any) => {
                        const st = Array.isArray(c.students) ? c.students[0] : c.students
                        return (
                          <form key={c.student_id} action={unlinkParent} className="inline" style={{ marginRight: 8 }}>
                            <input type="hidden" name="parent_id" value={p.id} />
                            <input type="hidden" name="student_id" value={c.student_id} />
                            <span className="tag">{st?.full_name} ({st?.admission_no})</span>{' '}
                            <button className="link" title="Unlink">✕</button>
                          </form>
                        )
                      })}
                    </div>
                  )}
                </td>
                <td>{p.email ?? '—'}</td>
                <td>
                  {me ? p.role : (
                    <form action={changeRole} className="row" style={{ margin: 0 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <select name="role" defaultValue={p.role}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="sec">Save</button>
                    </form>
                  )}
                </td>
                <td>{p.active ? <span className="good">Active</span> : <span className="bad">Disabled</span>}</td>
                <td>
                  <details>
                    <summary>More</summary>
                    <div className="stack">
                      {p.role === 'parent' && (
                        <form action={linkParent} className="row" style={{ margin: 0 }}>
                          <input type="hidden" name="parent_id" value={p.id} />
                          <input name="admission_no" placeholder="Child admission no." required />
                          <button className="sec">Link child</button>
                        </form>
                      )}
                      <form action={resetPassword} className="row" style={{ margin: 0 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <input name="password" type="password" minLength={8} placeholder="New password" required autoComplete="new-password" />
                        <button className="sec">Set password</button>
                      </form>
                      {!me && (
                        <form action={setActive}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="active" value={p.active ? 'false' : 'true'} />
                          <button className={p.active ? 'danger' : 'sec'}>{p.active ? 'Disable account' : 'Enable account'}</button>
                        </form>
                      )}
                    </div>
                  </details>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Create a login</h2>
      <p className="muted">
        For a parent, enter the admission number(s) of their children, comma-separated. The same parent
        gets one login for all of them. For a second child later, use “Link child”.
      </p>
      <form action={createUser} className="row">
        <label>Full name <input name="full_name" required /></label>
        <label>Email <input name="email" type="email" required autoComplete="off" /></label>
        <label>Password <input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <label>
          Role
          <select name="role" defaultValue="teacher">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Children (parents only) <input name="admission_nos" placeholder="ADM260001, ADM260007" /></label>
        <button>Create login</button>
      </form>
    </>
  )
}
