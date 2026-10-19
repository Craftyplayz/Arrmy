'use client'

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="center">
      <h1>Something went wrong</h1>
      <p className="muted">Radarr, Sonarr or Plex may be down or still starting. Give it a minute, then try again.</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
