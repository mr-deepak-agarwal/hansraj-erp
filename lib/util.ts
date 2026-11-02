import { redirect } from 'next/navigation'

const TZ = process.env.SCHOOL_TZ || 'Asia/Kolkata'

/** YYYY-MM-DD in the school's timezone, optionally n days in the past. */
export function today(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-CA', { timeZone: TZ })
}

export const inr = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0))

// Accepts `any` because Supabase's untyped client infers embedded relations loosely.
export const cls = (c: any): string => {
  const one = Array.isArray(c) ? c[0] : c
  return one ? `${one.name}${one.section ? `-${one.section}` : ''}` : '—'
}

export function grade(pct: number): string {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}

/** Trimmed string from a form field, or null when empty. */
export function val(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? '').trim()
  return v === '' ? null : v
}

/** If a Supabase call failed, go back to `path` and show the message. */
export function check(error: { message: string } | null | undefined, path: string) {
  if (error) redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(error.message)}`)
}

export function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`)
}

export const LOAN_DAYS = Number(process.env.LIBRARY_LOAN_DAYS) || 14
export const FINE_PER_DAY = process.env.LIBRARY_FINE_PER_DAY
  ? Number(process.env.LIBRARY_FINE_PER_DAY) || 0
  : 1

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
