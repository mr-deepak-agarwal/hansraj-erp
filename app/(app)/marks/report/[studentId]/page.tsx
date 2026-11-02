import Link from 'next/link'
import { notFound } from 'next/navigation'
import AiBox from '@/components/AiBox'
import PrintButton from '@/components/PrintButton'
import { requireRole } from '@/lib/auth'
import { cls, grade } from '@/lib/util'

export default async function ReportCard({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ exam?: string }>
}) {
  const { studentId } = await params
  const sp = await searchParams
  const { supabase: s } = await requireRole(['admin', 'teacher'])

  const { data: st } = await s
    .from('students')
    .select('full_name, admission_no, guardian_name, classes(name, section)')
    .eq('id', studentId)
    .maybeSingle()
  if (!st) notFound()

  const { data: exams } = await s.from('exams').select('*').order('created_at', { ascending: false })

  if (!sp.exam) {
    return (
      <>
        <p className="no-print"><Link href={`/students/${studentId}`}>← {st.full_name}</Link></p>
        <h1>Report card: {st.full_name}</h1>
        <p>Choose an exam:</p>
        <ul>
          {(exams ?? []).map((e: any) => (
            <li key={e.id}><Link href={`/marks/report/${studentId}?exam=${e.id}`}>{e.name}</Link></li>
          ))}
        </ul>
      </>
    )
  }

  const exam = (exams ?? []).find((e: any) => e.id === sp.exam)
  if (!exam) notFound()

  const { data: marks } = await s
    .from('marks')
    .select('marks_obtained, subjects(name)')
    .eq('student_id', studentId)
    .eq('exam_id', exam.id)

  const rows = (marks ?? [])
    .map((m: any) => ({ subject: m.subjects?.name ?? '—', got: Number(m.marks_obtained) }))
    .sort((a: any, b: any) => a.subject.localeCompare(b.subject))
  const total = rows.reduce((sum: number, r: any) => sum + r.got, 0)
  const maxTotal = rows.length * Number(exam.max_marks)
  const pct = maxTotal ? (total / maxTotal) * 100 : 0

  return (
    <>
      <p className="no-print">
        <Link href={`/students/${studentId}`}>← {st.full_name}</Link> <PrintButton label="Print report card" />
      </p>
      <h1>{process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School'} — Report card</h1>
      <p>
        <strong>{st.full_name}</strong> ({st.admission_no}) · Class {cls(st.classes)}
        <br />
        {exam.name}{exam.term ? ` · ${exam.term}` : ''}
      </p>

      <table className="tbl">
        <thead><tr><th>Subject</th><th className="r">Marks</th><th className="r">Out of</th><th>Grade</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.subject}>
              <td>{r.subject}</td>
              <td className="r">{r.got}</td>
              <td className="r">{exam.max_marks}</td>
              <td>{grade((r.got / Number(exam.max_marks)) * 100)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="muted">No marks entered for this exam.</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <th>Total</th><th className="r">{total}</th><th className="r">{maxTotal}</th>
              <th>{pct.toFixed(1)}% · {grade(pct)}</th>
            </tr>
          </tfoot>
        )}
      </table>

      {rows.length > 0 && (
        <>
          <h2>Teacher’s remarks</h2>
          <AiBox params={{ kind: 'remark', studentId, examId: exam.id }} label="Draft remarks with AI" />
        </>
      )}
    </>
  )
}
