import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pipeline · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function PipelinePhone() {
  return (
    <>
      <div className="lp-head"><h1>Phone</h1><p>Pictures of how the phone version would look: the pipeline turns vertical, stages stacked top to bottom, and the tabs move to the bottom.</p></div>
      <div className="lp-phones">
        {SHOTS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/pipeline/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
