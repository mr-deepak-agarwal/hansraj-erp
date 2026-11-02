import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { signOut } from '../login/actions'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { role, name, user } = await getSession()
  if (role !== 'parent') redirect('/')

  return (
    <>
      <header className="nav no-print">
        <strong>{process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School'} · Parent portal</strong>
        <nav>
          <Link href="/parent">My children</Link>
        </nav>
        <form action={signOut}>
          <span>{name || user.email}</span>
          <button className="link">Sign out</button>
        </form>
      </header>
      <main>{children}</main>
    </>
  )
}
