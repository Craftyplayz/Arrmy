import type { NextConfig } from 'next'

// agentRules: off, or `next dev` writes an AGENTS.md into the repo.
export default { output: 'standalone', agentRules: false } satisfies NextConfig
