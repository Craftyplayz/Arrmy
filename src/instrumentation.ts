export async function register() {
  // Only the real server wires the Stack: not `next dev`, not `next build`.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startWiring } = await import('./lib/wire')
    startWiring()
  }
}
