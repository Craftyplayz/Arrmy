import type { Metadata } from 'next'
import { requests, searchResults } from '../data'
import { Compose, Day, Head, Msg, RequestEmbed, Result } from './bits'

export const metadata: Metadata = { title: 'Chat feed · Home' }

const req = (id: number) => requests.find((r) => r.id === id)!

export default function ChatHome() {
  return (
    <>
      <Head name="home" topic="Say a title to request it. Arrmy replies with what it found and tells you when it lands on Plex." />
      <div className="lc-feed">
        <Day label="Yesterday" />
        <Msg from="Jo" time="Yesterday at 19:42">
          <p>Requested <b>The Bear</b> (Season 3)</p>
          <RequestEmbed r={req(103)} />
        </Msg>
        <Msg from="Arrmy" time="Yesterday at 21:10">
          <p><b>Arrival</b> is now Available on Plex. <span className="lc-mention">@Crafty</span> asked for it.</p>
          <RequestEmbed r={req(104)}>
            <div className="lc-acts"><button type="button" className="lc-b ok small">Open in Plex</button></div>
          </RequestEmbed>
        </Msg>
        <Day label="Today" />
        <Msg from="Sam" time="Today at 09:15">
          <p>Requested <b>Severance</b> (Seasons 1, 2)</p>
          <RequestEmbed r={req(102)} />
        </Msg>
        <Msg from="Arrmy" time="Today at 12:03">
          <p><b>Dune: Part Two</b> is now Available on Plex. <span className="lc-mention">@Crafty</span> asked for it.</p>
          <RequestEmbed r={req(101)}>
            <div className="lc-acts"><button type="button" className="lc-b ok small">Open in Plex</button></div>
          </RequestEmbed>
        </Msg>
        <Msg from="Crafty" time="Today at 14:20"><p>the</p></Msg>
        <Msg from="Arrmy" time="Today at 14:20">
          <p>{searchResults.length} titles match <b>the</b>. Press Request on the one you want; the ones with a chip are already on the way.</p>
          {searchResults.map((t) => <Result key={t.id} t={t} />)}
        </Msg>
      </div>
      <Compose channel="home" value="the" placeholder="Type a title to request it…" hint="Arrmy searches as you type. Say which seasons in the same message, like Severance season 2." />
    </>
  )
}
