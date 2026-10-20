import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'
import { signIn } from '../actions'
import { SubmitButton } from '../submit-button'

export const metadata: Metadata = { title: 'Sign In' }

const ERRORS: Record<string, string> = {
  'no-access': "That Plex account doesn't have access to this Plex server. Ask the Admin to share their libraries with you.",
  failed: "Plex sign-in didn't finish. Try again.",
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect('/')
  const { error } = await searchParams
  return (
    <section className="card ar-center">
      <h1 className="page-title">Arrmy</h1>
      <p className="page-lede">Request movies, TV shows and audiobooks for the family Plex server.</p>
      {error && <p className="err">{ERRORS[error] ?? ERRORS.failed}</p>}
      <form action={signIn}>
        <SubmitButton className="btn primary" pending="Opening Plex...">
          Sign in with Plex
        </SubmitButton>
      </form>
    </section>
  )
}
