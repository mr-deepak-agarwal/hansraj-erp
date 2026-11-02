import { signOut } from '../login/actions'

export default function Disabled() {
  return (
    <div className="login">
      <h1>Account not active</h1>
      <p>
        Your account has been disabled or has no access set up yet. Please contact the school
        office.
      </p>
      <form action={signOut}>
        <button>Sign out</button>
      </form>
    </div>
  )
}
