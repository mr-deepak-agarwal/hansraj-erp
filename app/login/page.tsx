import { signIn } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  return (
    <div className="login">
      <h1>{process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School ERP'}</h1>
      {sp.error && <p className="err">{sp.error}</p>}
      <form action={signIn}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <p className="muted" style={{ fontSize: 13 }}>
        Staff accounts are created by the administrator in Supabase.
      </p>
    </div>
  )
}
