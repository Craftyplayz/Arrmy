import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Calendar · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function CalendarPhone() {
  return (
    <>
      <div className="lc-toolbar"><h1>Phone</h1></div>
      <p className="lc-lede">
        Pictures of how the phone version would look: the month becomes a compact grid with dots, with the day&apos;s events listed under it, and the tabs move
        to the bottom.
      </p>
      <div className="lc-phones">
        {SHOTS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/calendar/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
