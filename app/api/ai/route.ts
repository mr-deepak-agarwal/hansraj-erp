import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { askAI } from '@/lib/ai'
import { grade, inr, today } from '@/lib/util'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SCHOOL = process.env.NEXT_PUBLIC_SCHOOL_NAME || 'the school'

// Privacy: prompts only ever contain a student's first name and marks/amounts.
// No phone numbers, addresses, admission numbers or surnames are sent to the AI.
const firstName = (full: string) => full.trim().split(/\s+/)[0]

export async function POST(req: Request) {
  const s = await createClient()
  const {
    data: { user },
  } = await s.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // auth_role() returns null for disabled users. Each AI tool is limited to the roles that
  // may already see the underlying data.
  const { data: role } = await s.rpc('auth_role')
  const allowed = (roles: string[]) => typeof role === 'string' && roles.includes(role)

  const body = await req.json().catch(() => ({}))
  try {
    if (body.kind === 'insights' && allowed(['admin'])) return NextResponse.json(await insights(s))
    if (body.kind === 'remark' && allowed(['admin', 'teacher']) && UUID.test(body.studentId) && UUID.test(body.examId))
      return NextResponse.json(await remark(s, body.studentId, body.examId))
    if (body.kind === 'reminder' && allowed(['admin', 'accounts']) && UUID.test(body.studentId))
      return NextResponse.json(await reminder(s, body.studentId))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
}

async function insights(s: SupabaseClient) {
  const t = today()
  const [students, att7, att30, fees, overdue, pending] = await Promise.all([
    s.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('attendance').select('status').gte('date', today(7)),
    s.from('attendance').select('student_id, status').gte('date', today(30)).eq('status', 'absent').limit(5000),
    s.from('fee_summary').select('*').single(),
    s.from('fee_invoice_balances').select('balance').lt('due_date', t).gt('balance', 0).limit(5000),
    s.from('admissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const a7 = att7.data ?? []
  const attendancePct = a7.length
    ? Math.round((a7.filter((a: any) => a.status !== 'absent').length / a7.length) * 100)
    : null

  const absences = new Map<string, number>()
  for (const a of att30.data ?? []) absences.set(a.student_id, (absences.get(a.student_id) ?? 0) + 1)
  const frequentAbsentees = [...absences.values()].filter((n) => n >= 4).length

  const billed = Number(fees.data?.billed ?? 0)
  const collected = Number(fees.data?.collected ?? 0)
  const overdueRows = overdue.data ?? []
  const overdueAmount = overdueRows.reduce((sum: number, r: any) => sum + Number(r.balance), 0)

  const stats = {
    activeStudents: students.count ?? 0,
    attendanceLast7DaysPercent: attendancePct,
    studentsAbsent4PlusDaysInLast30: frequentAbsentees,
    feesBilled: inr(billed),
    feesCollected: inr(collected),
    feesOutstanding: inr(billed - collected),
    overdueInvoices: overdueRows.length,
    overdueAmount: inr(overdueAmount),
    pendingAdmissionApplications: pending.count ?? 0,
  }

  const fallback = [
    `• Attendance over the last 7 days: ${attendancePct === null ? 'no data yet' : attendancePct + '%'}.`,
    `• ${frequentAbsentees} student(s) were absent 4 or more days in the last 30 — consider calling their guardians.`,
    `• Fees outstanding ${stats.feesOutstanding}; ${overdueRows.length} invoice(s) are overdue (${stats.overdueAmount}).`,
    `• ${stats.pendingAdmissionApplications} admission application(s) are waiting for a decision.`,
  ].join('\n')

  const prompt = `You are an assistant to the principal of ${SCHOOL}. Here are today's school statistics as JSON:
${JSON.stringify(stats)}

Write 4 to 5 short bullet points (start each with "•"). Each one should say what stands out and give one concrete suggested action for the office. Use only the numbers given; do not invent data. If something has no data yet, say so briefly. Plain text, no markdown headings.`

  return askAI(prompt, fallback)
}

async function remark(s: SupabaseClient, studentId: string, examId: string) {
  const [{ data: st }, { data: exam }, { data: marks }] = await Promise.all([
    s.from('students').select('full_name').eq('id', studentId).single(),
    s.from('exams').select('name, max_marks').eq('id', examId).single(),
    s.from('marks').select('marks_obtained, subjects(name)').eq('student_id', studentId).eq('exam_id', examId),
  ])
  if (!st || !exam || !marks?.length) throw new Error('No marks found for this exam')

  const max = Number(exam.max_marks)
  const subj = marks
    .map((m: any) => ({
      name: m.subjects?.name ?? 'Subject',
      pct: Math.round((Number(m.marks_obtained) / max) * 100),
    }))
    .sort((a: any, b: any) => b.pct - a.pct)
  const overall = Math.round(subj.reduce((x: number, y: any) => x + y.pct, 0) / subj.length)
  const name = firstName(st.full_name)
  const best = subj[0]
  const weakest = subj[subj.length - 1]

  const fallback =
    `${name} achieved ${overall}% overall (grade ${grade(overall)}). ` +
    `${best.name} is a clear strength (${best.pct}%). ` +
    (weakest.pct < 60 && weakest.name !== best.name
      ? `More regular practice in ${weakest.name} (${weakest.pct}%) will help. `
      : `Keep up the steady effort across all subjects. `) +
    `Well done, and keep going.`

  const prompt = `Write a short report-card remark (2 to 3 sentences) from a class teacher about a student named ${name}, for the exam "${exam.name}".
Results by subject (percent): ${subj.map((x: any) => `${x.name} ${x.pct}%`).join(', ')}. Overall ${overall}%.
Be warm, specific and honest. Mention one strength and one area to improve (if any). Do not mention exact percentages. Plain text only.`

  return askAI(prompt, fallback)
}

async function reminder(s: SupabaseClient, studentId: string) {
  const [{ data: st }, { data: invs }] = await Promise.all([
    s.from('students').select('full_name, guardian_name').eq('id', studentId).single(),
    s
      .from('fee_invoice_balances')
      .select('title, due_date, balance')
      .eq('student_id', studentId)
      .gt('balance', 0)
      .order('due_date'),
  ])
  if (!st || !invs?.length) throw new Error('No outstanding fees for this student')

  const name = firstName(st.full_name)
  const total = invs.reduce((sum: number, i: any) => sum + Number(i.balance), 0)
  const t = today()
  const lines = invs.map(
    (i: any) => `${i.title}: ${inr(i.balance)} due ${i.due_date}${i.due_date < t ? ' (overdue)' : ''}`
  )

  const fallback =
    `Dear Parent/Guardian,\n\nThis is a gentle reminder from ${SCHOOL} that the following fees for ${name} are pending:\n` +
    lines.map((l: string) => `- ${l}`).join('\n') +
    `\n\nTotal outstanding: ${inr(total)}. Kindly clear the dues at the earliest, or contact the school office if you have already paid or need help.\n\nThank you,\n${SCHOOL} Office`

  const prompt = `Write a polite, brief fee reminder message (suitable for WhatsApp or SMS, under 90 words) from the office of ${SCHOOL} to the guardian of a student named ${name}.
Pending items: ${lines.join('; ')}. Total outstanding: ${inr(total)}.
Tone: respectful and warm, not threatening. Invite them to contact the office if already paid or facing difficulty. Sign off as "${SCHOOL} Office". Plain text only.`

  return askAI(prompt, fallback)
}
