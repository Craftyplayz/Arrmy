'use client'

import { useFormStatus } from 'react-dom'

/** A form's button that says it's working, and can't be pressed twice, while its server action runs. */
export function SubmitButton({ pending, className = 'btn', children }: { pending: string; className?: string; children: React.ReactNode }) {
  const form = useFormStatus()
  return (
    <button className={className} disabled={form.pending}>
      {form.pending ? pending : children}
    </button>
  )
}
