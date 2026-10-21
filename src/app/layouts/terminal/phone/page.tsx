import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terminal · Phone' }

const SCREENS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function Phone() {
  return (
    <>
      <p className="lt-prompt"><b>&gt;</b> phone: <span className="lt-dim">pictures of how the phone version would look: fewer columns, and the bottom key bar becomes tap buttons.</span></p>
      <div className="lt-phones">
        {SCREENS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/terminal/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
