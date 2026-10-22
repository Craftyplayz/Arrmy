import type { NextConfig } from 'next'

// agentRules: off, or `next dev` writes an AGENTS.md into the repo.
// staleTimes: a page visited in the last 30 seconds opens from memory; pages with live numbers refresh themselves anyway.
// serverExternalPackages: undici bundled into the server fails every request ("fetch failed"); loaded as-is it works.
export default {
  output: 'standalone',
  agentRules: false,
  serverExternalPackages: ['undici'],
  experimental: { staleTimes: { dynamic: 30 } },
} satisfies NextConfig
