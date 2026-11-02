import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { LOAN_DAYS, today } from '@/lib/util'
import { addBook, issueBook } from './actions'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>
}) {
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin', 'teacher'])

  let query = s.from('book_availability').select('*').order('title').limit(300)
  if (sp.q) {
    const q = sp.q.replace(/[,()%*]/g, ' ').trim()
    if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%,category.ilike.%${q}%`)
  }
  const { data: books } = await query
  const defaultDue = today(-LOAN_DAYS)

  return (
    <>
      <h1>Library</h1>
      <p><Link href="/library/loans">View issued books and returns →</Link></p>
      {sp.error && <p className="err">{sp.error}</p>}

      <form className="row" method="get">
        <label>Search <input name="q" defaultValue={sp.q ?? ''} placeholder="Title, author, ISBN, category" /></label>
        <button className="sec">Search</button>
      </form>

      <table className="tbl">
        <thead>
          <tr><th>Title</th><th>Author</th><th>Category</th><th className="r">Copies</th><th className="r">Available</th><th>Issue to student</th></tr>
        </thead>
        <tbody>
          {(books ?? []).map((b: any) => (
            <tr key={b.id}>
              <td>{b.title}{b.isbn && <div className="muted" style={{ fontSize: 12 }}>ISBN {b.isbn}</div>}</td>
              <td>{b.author ?? '—'}</td>
              <td>{b.category ?? '—'}</td>
              <td className="r">{b.copies}</td>
              <td className={`r ${b.available > 0 ? 'good' : 'bad'}`}>{b.available}</td>
              <td>
                {b.available > 0 ? (
                  <form action={issueBook} className="row" style={{ margin: 0 }}>
                    <input type="hidden" name="book_id" value={b.id} />
                    <input name="admission_no" placeholder="Admission no." required style={{ width: 120 }} />
                    <input name="due_on" type="date" defaultValue={defaultDue} min={today()} required />
                    <button>Issue</button>
                  </form>
                ) : <span className="muted">All copies out</span>}
              </td>
            </tr>
          ))}
          {!books?.length && <tr><td colSpan={6} className="muted">No books found.</td></tr>}
        </tbody>
      </table>

      <h2>Add a book</h2>
      <form action={addBook} className="row">
        <label>Title <input name="title" required /></label>
        <label>Author <input name="author" /></label>
        <label>ISBN <input name="isbn" /></label>
        <label>Category <input name="category" placeholder="Fiction, Science…" /></label>
        <label>Copies <input name="copies" type="number" min="1" defaultValue={1} required style={{ width: 80 }} /></label>
        <button>Add book</button>
      </form>
    </>
  )
}
