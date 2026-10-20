export async function register() {
  // Only the real server wires the Stack and watches downloads: not `next dev`, not `next build`.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const [{ startWiring }, { startAudiobookWatch }, { startDeadReleaseWatch }, { startBot }] = await Promise.all([
      import('./lib/wire'),
      import('./lib/books'),
      import('./lib/dead'),
      import('./lib/feeds'),
    ])
    startWiring()
    startAudiobookWatch()
    startDeadReleaseWatch()
    startBot()
  }
}
