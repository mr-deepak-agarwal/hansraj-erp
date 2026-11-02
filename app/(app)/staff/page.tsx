import { requireRole } from '@/lib/auth'
import { addStaff, setStaffStatus } from './actions'

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin', 'hr'])

  let query = s.from('staff_members').select('*').order('full_name').limit(500)
  if (sp.show !== 'all') query = query.eq('status', 'active')
  if (sp.q) {
    const q = sp.q.replace(/[,()%*]/g, ' ').trim()
    if (q) query = query.or(`full_name.ilike.%${q}%,designation.ilike.%${q}%,department.ilike.%${q}%`)
  }
  const { data: staff } = await query

  return (
    <>
      <h1>Staff directory</h1>
      {sp.error && <p className="err">{sp.error}</p>}

      <form className="row" method="get">
        <label>Search <input name="q" defaultValue={sp.q ?? ''} placeholder="Name, designation, department" /></label>
        <label>
          Show
          <select name="show" defaultValue={sp.show ?? 'active'}>
            <option value="active">Active only</option>
            <option value="all">Including former staff</option>
          </select>
        </label>
        <button className="sec">Filter</button>
      </form>

      <table className="tbl">
        <thead>
          <tr><th>Name</th><th>Designation</th><th>Department</th><th>Phone</th><th>Email</th><th>Joined</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {(staff ?? []).map((m: any) => (
            <tr key={m.id}>
              <td>{m.full_name}{m.notes && <div className="muted" style={{ fontSize: 12 }}>{m.notes}</div>}</td>
              <td>{m.designation ?? '—'}</td>
              <td>{m.department ?? '—'}</td>
              <td>{m.phone ?? '—'}</td>
              <td>{m.email ?? '—'}</td>
              <td>{m.joined_on ?? '—'}</td>
              <td>{m.status === 'active' ? 'Active' : <span className="muted">Left</span>}</td>
              <td>
                <form action={setStaffStatus}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="status" value={m.status === 'active' ? 'left' : 'active'} />
                  <button className="sec">{m.status === 'active' ? 'Mark as left' : 'Re-activate'}</button>
                </form>
              </td>
            </tr>
          ))}
          {!staff?.length && <tr><td colSpan={8} className="muted">No staff found.</td></tr>}
        </tbody>
      </table>

      <h2>Add a staff member</h2>
      <p className="muted">
        This is the HR record. Giving someone a login is done by the administrator on the Users page.
      </p>
      <form action={addStaff} className="row">
        <label>Full name <input name="full_name" required /></label>
        <label>Designation <input name="designation" placeholder="Maths teacher" /></label>
        <label>Department <input name="department" placeholder="Academics" /></label>
        <label>Phone <input name="phone" inputMode="tel" /></label>
        <label>Email <input name="email" type="email" /></label>
        <label>Joined on <input name="joined_on" type="date" /></label>
        <label>Notes <input name="notes" /></label>
        <button>Add staff</button>
      </form>
    </>
  )
}
