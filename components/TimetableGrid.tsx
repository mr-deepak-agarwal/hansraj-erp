import { cls, DAY_NAMES } from '@/lib/util'

type Props = {
  slots: any[]
  periods: any[]
  /** 'class' shows subject + teacher; 'teacher' shows class + subject. */
  show: 'class' | 'teacher'
}

const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '')

export default function TimetableGrid({ slots, periods, show }: Props) {
  const map = new Map<string, any>(slots.map((s) => [`${s.day}-${s.period}`, s]))
  const one = (x: any) => (Array.isArray(x) ? x[0] : x)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl tt">
        <thead>
          <tr>
            <th>Period</th>
            {DAY_NAMES.map((d) => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.period}>
              <th>
                {p.label ?? `Period ${p.period}`}
                <small>{hhmm(p.start_time)}–{hhmm(p.end_time)}</small>
              </th>
              {DAY_NAMES.map((_, i) => {
                const s = map.get(`${i + 1}-${p.period}`)
                if (!s) return <td key={i} className="empty">–</td>
                const subject = one(s.subjects)?.name ?? '—'
                const teacher = one(s.profiles)?.full_name
                return (
                  <td key={i}>
                    {show === 'teacher' ? (
                      <>
                        <strong>{cls(s.classes)}</strong>
                        <small>{subject}{s.room ? ` · ${s.room}` : ''}</small>
                      </>
                    ) : (
                      <>
                        <strong>{subject}</strong>
                        <small>{[teacher, s.room].filter(Boolean).join(' · ')}</small>
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
