import type { NextConfig } from 'next'

// agentRules: off, or `next dev` writes an AGENTS.md into the repo.
// staleTimes: a page visited in the last 30 seconds opens from memory; pages with live numbers refresh themselves anyway.
export default { output: 'standalone', agentRules: false, experimental: { staleTimes: { dynamic: 30 } } } satisfies NextConfig
