import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Search first · Phone' }

const SCREENS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function Phone() {
  return (
    <div className="ls-col wide">
      <h1 className="ls-h1">On a phone</h1>
      <p className="ls-sum">Pictures of how the phone version would look. The tabs move to the bottom; everything else stays one column.</p>
      <div className="ls-phones">
        {SCREENS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/search/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
