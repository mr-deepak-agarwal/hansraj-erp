import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession, NAV } from '@/lib/auth'
import { signOut } from '../login/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, name } = await getSession()
  if (role === 'parent') redirect('/parent')

  return (
    <>
      <header className="nav no-print">
        <strong>{process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School ERP'}</strong>
        <nav>
          {NAV.filter((n) => n.roles.includes(role)).map((n) => (
            <Link key={n.href} href={n.href}>{n.label}</Link>
          ))}
        </nav>
        <form action={signOut}>
          <span>{name || user.email} · {role}</span>
          <button className="link">Sign out</button>
        </form>
      </header>
      <main>{children}</main>
    </>
  )
}
