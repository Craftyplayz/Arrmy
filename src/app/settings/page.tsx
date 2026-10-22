import { redirect } from 'next/navigation'

/** Settings moved into the Admin page; old links still land there. */
export default function SettingsPage() {
  redirect('/admin')
}
