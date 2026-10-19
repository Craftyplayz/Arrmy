import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'
import { signIn } from '../actions'

const ERRORS: Record<string, string> = {
  'no-access': "That Plex account doesn't have access to this Plex server. Ask the Admin to share their libraries with you.",
  failed: "Plex sign-in didn't finish. Try again.",
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect('/')
  const { error } = await searchParams
  return (
    <div className="center">
      <h1>Arrmy</h1>
      <p className="muted">Request movies and TV shows for the family Plex server.</p>
      {error && <p className="error">{ERRORS[error] ?? ERRORS.failed}</p>}
      <form action={signIn}>
        <button>Sign in with Plex</button>
      </form>
    </div>
  )
}
