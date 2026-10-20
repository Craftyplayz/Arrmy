'use client'

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <section className="card ar-center">
      <h1 className="page-title">Something went wrong</h1>
      <p className="page-lede">Radarr, Sonarr or Plex may be down or still starting. Give it a minute, then try again.</p>
      <button className="btn primary" onClick={() => retry()}>
        Try again
      </button>
    </section>
  )
}
