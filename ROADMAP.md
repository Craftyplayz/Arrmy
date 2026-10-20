# Roadmap

What Arrmy does, how well each part is tested, and what comes next. Last checked against the server on 2026-10-20 (release v1.1.0-rc.5).

**Tested** means:

- **Unit**: automated tests in `test/` (`npm test`).
- **Fake**: the whole flow run on a dev PC against fake Radarr, Sonarr, qBittorrent, LazyLibrarian and Audiobookshelf.
- **Live**: seen working on the real server.

## Done

### Movies and TV

| Feature | What it does | Tested |
|---|---|---|
| Sign in with Plex | Plex PIN sign-in. The Plex server's owner is the Admin, people it's shared with are Requesters, anyone else is turned away. | Unit, Fake, Live for the Admin. **Not yet live:** a Requester signing in. |
| Search and Request | Search movies and shows; request a movie, or chosen seasons of a show. Radarr or Sonarr starts searching straight away. | Fake, Live |
| Status | Requested → Downloading (live %, read from qBittorrent every 5 seconds) → Available. | Unit, Fake, Live up to Downloading. **Not yet live:** Available (nothing has finished importing yet). |
| Episode files | A show's panel lists every episode of its requested seasons with its file, its state (Available, Downloading, Queued, Waiting for a release, Not aired yet…) and a progress bar, read live from Sonarr and qBittorrent while the panel is open. Files are matched to episodes by `S01E03`, else by Sonarr's own parser (`1x03`, anime numbering, double episodes). The poster's % covers every file of the Request, weighted by size. | Unit (the poster %), Live (Sonarr's parser). **Not yet live:** the panel itself. |
| Edit seasons | Add or remove seasons of a requested show. Removed seasons are deleted unless someone else requested them. | Fake. **Not yet live.** |
| Remove | Cancels a Request if nothing has downloaded; otherwise deletes the download and the files, keeping whatever another Request still wants. | Fake. **Not yet live.** |
| Discord message | Posts in #requests when a Request becomes Available (see Discord bot). | Fake. **Not yet live.** |
| Size limits | The Admin sets a maximum per movie, per hour of episode and per show (Settings). Bigger releases are never grabbed; a TV Request that could go over the show limit is refused with the estimate. | Fake. **Not yet live:** no limits are set on the server. |
| Request Log (stage 1) | Each Request's page (Requests → Request Log) lists every step with when it started and how long it took, a ticking timer on the step running now, and the total from Request to playable. Searching, then per release: Downloading (release, indexer, size and quality for the Admin; average speed, most seeders and peers), dead releases swapped, Importing (file, quality, resolution, codec, audio languages, subtitles), and Showing up in Plex until Plex lists it. Copy log copies it as text. The Admin can download each grabbed release's .torrent, saved when it was grabbed. Requesters see their own Request's steps without release names, indexers or errors. | Unit (the steps), Local (Radarr-shaped Grab and Download webhooks, the page as Admin and as another Requester). **Not yet live.** |
| English-only audio | At the same quality, Radarr and Sonarr pick a release with only English audio over MULTi, Dual Audio or another language, so files are smaller. Untagged releases count as the original language, so foreign films and anime are left alone. | Unit, Live (the rule is in Radarr and Sonarr) |

### Audiobooks

| Feature | What it does | Tested |
|---|---|---|
| Search | The Audiobooks tab searches OpenLibrary directly, in about a second. With an Audiobookshelf API key, books already in Audiobookshelf show as Available. | Unit, Fake, Live |
| Request | LazyLibrarian adds the book, searches the indexers through Prowlarr and sends the best release to qBittorrent. | Fake, Live |
| AudioBook Bay | LazyLibrarian also searches AudioBook Bay, the main public source of audiobooks, which the general indexers mostly lack. The site answers 404 to LazyLibrarian's user agent, so its searches go through a small relay inside Arrmy (an internal port, never published, with a key in the address), which fetches the same pages as a browser. The Wiring points LazyLibrarian there once and searches again for every wanted audiobook. | Local (the relay, against a fake site). **Not yet live.** |
| Status | Requested → Downloading % → Available. Arrmy checks LazyLibrarian every 2 minutes. | Unit, Fake, Live |
| Filing | Every 10 minutes LazyLibrarian copies finished downloads to `media/audiobooks/Author/Title` (the torrent keeps seeding). Audiobookshelf picks the book up, and Discord gets a message. | Fake, Live (Dune, 2026-10-20). **Not yet live:** the Discord message. |
| Remove | Cancels the Request, or deletes the torrent. Once the book is in Audiobookshelf, deletes that copy too, but only one added after the Request was made, so books you already had are never touched. | Unit (the matching rule), Fake, Live during a download. **Not yet live:** after it's in Audiobookshelf. |
| Already have it | A requested audiobook Audiobookshelf already has (a copy from before Arrmy) becomes Available, and LazyLibrarian stops looking for it, so it isn't downloaded twice. A removed one that LazyLibrarian grabs anyway (its search was still running) is stopped and its torrent deleted, for a day after the Remove. | Unit (the removed-book rule). **Not yet live.** |
| Existing library | The Audiobookshelf already in use moved into the stack with all its books, users, progress and stats. | Live |

### Admin

| Feature | What it does | Tested |
|---|---|---|
| Admin view | Problems (Missing, Failed Download, Failed Import) with one-click fixes: search again, or blocklist the release and try another. Also what's downloading, speeds, library counts, disk space and Requests by person. | Unit (the Problem rules), Fake, Live (the page). **Not yet live:** a real Problem and its fix. |
| Settings | Size limits (see Movies and TV). | Fake |
| Downloading | Every movie, show and audiobook downloading, read straight from qBittorrent every 3 seconds without reloading the page: poster, title, who asked, progress, speed, time left, seeders and peers, and the state in words (Downloading, Stalled, Fetching file list, Queued, Paused, Checking). | Unit (the states), Live (v1.1.0-rc.23: a movie with its poster, who asked, speed and time left) |
| Stuck | Every Request that hasn't started downloading or has stopped, and why: Searching, Not released yet (with the cinema, digital or disc date), Nothing found (when it was last searched), or in qBittorrent but Stalled, Fetching file list, Queued, Paused or Error (how far it got, when it last moved, seeders). Audiobooks LazyLibrarian wants and hasn't found too. Once at the top: qBittorrent with no connection (the VPN), and indexers Prowlarr has switched off and until when. Stalled downloads keep "Try another release", Nothing found keeps "Search again". Missing moved here from Problems (Discord's #problems still gets it). | Unit (the rules), Live (v1.1.0-rc.24: the indexer notice, audiobooks not found with who asked), Local (stalled and queued torrents, through a fake qBittorrent). For about a minute after a redeploy Radarr's queue is empty, so a downloading movie can show as Searching. **Later:** why every release was rejected (needs the Request Log), and each indexer's error text (Prowlarr's history doesn't keep it). |
| Dead releases | A torrent with no file list 5 minutes after it was added, or nothing downloaded after 15, is swapped for another release: Radarr and Sonarr blocklist it and search again; for audiobooks Arrmy deletes it, waits for LazyLibrarian to mark it Failed, then searches again (about 2 minutes). LazyLibrarian sometimes grabs the same dead release again; that counts as another strike. After 3 dead releases in a row for the same title, the third is left alone, it shows as a Failed Download Problem, and Discord @mentions the Admin (`DISCORD_ADMIN_ID`). Torrents in other qBittorrent categories, and paused ones, are never touched. | Unit (the rule), Fake. **Not yet live.** |

### Stack and deployment

| Feature | What it does | Tested |
|---|---|---|
| One stack | Arrmy, Plex, qBittorrent, gluetun (VPN), Prowlarr, FlareSolverr, Radarr, Sonarr, LazyLibrarian, Audiobookshelf, cloudflared and backups in one Portainer stack. | Live |
| Deploy from GitHub | GitHub Actions builds the image. Portainer deploys a release tag: `vX.Y.Z` runs `arrmy:X.Y.Z`. | Live |
| First-run setup | A one-shot `init` container creates the folders and writes qBittorrent's and LazyLibrarian's settings the first time, never overwriting them. | Unit, Live |
| Wiring | Arrmy connects the apps itself: root folders, download clients, its webhook, Prowlarr → Radarr, Sonarr and LazyLibrarian, the FlareSolverr proxy, size limits and English-only audio. It retries every 30 seconds until everything is connected, and creates the Plex libraries. | Fake, Live |
| Bulk indexers | `scripts/add-indexers.mjs` adds every public English indexer that passes Prowlarr's test. | Live (25 indexers) |
| Configurable ports | Every port is a variable. Defaults: 7654–7659, Plex 32400, Audiobookshelf 13378. | Live |
| VPN | PIA with port forwarding. qBittorrent only connects through the VPN; Prowlarr and FlareSolverr reach indexers through it. | Live |
| Seeding | Every torrent seeds, not just a few at a time. | Live (Dune seeds after filing) |
| Config backups | Every app's settings copied nightly and kept for a week (restore steps in the README). | Live (a backup ran and includes Audiobookshelf's database). **Never tried:** a restore. |
| Cloudflare Tunnel | Public addresses for Arrmy and the apps. | Live |
| Media files on your PC | Through the server's own Samba share, so the stack doesn't run one. | Not part of Arrmy |

### Discord bot

A Discord app with no live connection: Arrmy calls Discord's API with the bot's token, and Discord sends slash commands to `https://arrmy.<domain>/api/discord`, checked against the app's public key. Read-only: an update is something you start in Portainer (ADR 0001). Setup in the README. Without the bot, `DISCORD_WEBHOOK_URL` still gets #requests and #problems.

Every message is a card in DESIGN.md's colours (green for Available and success, red for failures, --info for Downloading and notes, the accent for something to act on) with art beside it: the poster or cover from Radarr, Sonarr or OpenLibrary, a Plex avatar, a committer's GitHub avatar, or the app's icon. The title links to the title's page on TMDB, TVDB or OpenLibrary, and the author line to the app on this server. No emoji; British English.

| Feature | What it does | Tested |
|---|---|---|
| Channels | An Arrmy category with #requests, #downloads, #downloaded, #problems, #admin-log, #system, #updates and #activity, made by the bot (again if one is deleted). Links go to each app's public address (`PUBLIC_DOMAIN`). | Fake |
| #requests | New Requests, edits and removals (who did it, and whose Request it was), Requests refused for the Size Limit, and Available. | Messages: Fake. **Not yet run:** the calls from Arrmy's pages. |
| #downloads | One card per download, titled with the movie, show or book (the release name small underneath), updated every 5 seconds: a smooth progress bar in DESIGN.md's --btn → --accent gradient (its 50 pieces are drawn by Arrmy and uploaded once as the bot's own emoji), then speed, time left, seeders and who asked. When it finishes, the card moves to #downloaded with how long it took; a removed torrent's card is deleted, so #downloads only ever shows what's downloading. Discord allows about 5 edits per 5 seconds in a channel, so each round edits the 4 that waited longest. | Unit, Fake |
| #problems | A new Problem once it has lasted 20 minutes (Arrmy fixes most stalled downloads within 15), or at once when Arrmy raised it after 3 dead releases. @mentions the Admin. Also each dead release Arrmy swaps. | Fake |
| #admin-log | Size Limit changes and one-click fixes, with who. Settings changed inside Radarr, Sonarr, Prowlarr and qBittorrent, checked every 5 minutes, with passwords and keys hidden (not LazyLibrarian: its API reads one setting at a time). People given or losing access to Plex or Audiobookshelf. | Unit, Fake. **Not yet run:** the calls from Arrmy's pages. |
| #system | An app down (two failed checks a minute apart), back or restarted. The VPN down, or its forwarded port changing. Health warnings from Radarr, Sonarr and Prowlarr (failing indexers). A disk under 10% free. Each nightly backup, or none for 26 hours. @mentions for down, disk and backup. | Fake |
| #updates | Arrmy commits and releases, and when the server starts running a new one. New releases of Radarr, Sonarr, Prowlarr, qBittorrent, Audiobookshelf, FlareSolverr, gluetun, cloudflared and Plex, checked every 6 hours against what the server runs, with a link to Portainer. @mentions for app updates and full Arrmy releases. LazyLibrarian has no releases, only commits, so it isn't watched. | Unit (versions), Fake |
| #activity | Sign-ins to Arrmy. Who started watching in Plex (needs the Admin to sign in once, which keeps their Plex token) or listening in Audiobookshelf, with the device. | Sessions: Fake. **Not yet run:** sign-ins. |
| Slash commands | `/status`, `/queue`, `/requests [person]`, `/problems`, `/search`. Admin-only at first (Server Settings → Integrations opens them up); only whoever asked sees the answer. | Answers: Fake. Endpoint: Local (signatures, Discord's check, the answer sent afterwards). |

## Next: release v1.1.0

Finish testing on the server, then publish v1.1.0.

Audiobooks:

1. ~~An audiobook goes all the way into Audiobookshelf and shows Available.~~ Done: Dune, 2026-10-20.
2. Remove an audiobook that's already in Audiobookshelf.

Movies and TV:

3. A movie and a TV season import into Plex and show Available.
4. Edit seasons and Remove on a real show and movie.
5. Set size limits in Settings and check Radarr and Sonarr picked them up.
6. Open a downloading show's panel: every episode has a row, and each bar moves on its own.

Everyone:

7. Set up the Discord bot (README → Discord): the channels appear, a Request shows in #requests, and `/status` answers.
8. A Requester signs in.
9. A dead release is swapped by itself, and a third in a row becomes a Problem and @mentions you (set `DISCORD_ADMIN_ID` first).

Tidy-up: `SMB_USER` and `SMB_PASSWORD` in the Portainer stack are unused since the stack's Samba was dropped, and can be deleted.

## Later

### Request Log

Stage 1 is built (see Done → Movies and TV): the log from Radarr's and Sonarr's grab and import webhooks, qBittorrent and Plex. Still to come: Arrmy running the search itself (every release and why the others were rejected, indexer health), edits, removals and one-click fixes in the log, refused Requests, Discord on failures, and audiobooks.

A full log for each Request, from the moment it's made to the moment it can be played in Plex or Audiobookshelf. Choices settled on 2026-10-20.

What it shows:

- Who requested it, and every step with its start time, end time and how long it took. The step running now has a ticking timer. At the end, the total from Request to playable.
- Every release the indexers returned, with its score, size and seeders, and for the ones not picked, why (over the Size Limit, wrong quality and so on). Which indexers answered, how fast, and which errored or timed out.
- The release that was grabbed, with a link to download its .torrent file.
- The download: speed, seeders and peers along the way, and the average speed at the end.
- Where the file ended up: size, quality, video codec, audio languages, subtitles.
- Anything that went wrong and what was done about it, whether by Arrmy, Radarr or Sonarr, or a person (who clicked, and when). Edits and removals too.
- A Copy log button that copies the whole log as plain text.

Rules:

- The Admin sees everything. Requesters see their own Request's steps and times, without the releases, .torrent links or error details.
- Refused Requests (over the Size Limit) get a log too, with the estimate.
- Auto-fix: a download that fails, or stalls for too long, is blocklisted and the next-best release from the list is grabbed, with each step logged. After a few tries it becomes a Problem on the Admin page instead.
- Discord gets a message when something fails or is auto-fixed, not just when it's Available.
- The log ends when the item shows in Plex or Audiobookshelf, not when Arrmy marks it Available.

How:

- Arrmy runs the search itself: it asks Radarr or Sonarr for every release (`GET /release`), logs them all, then grabs the top one (`POST /release`). That's the same pick Radarr or Sonarr would make, from a single search. Movies and shows are added with their own automatic search turned off.
- The webhook Radarr and Sonarr call also sends Grab events (the release and its download id), not just imports.
- qBittorrent: speeds and seeders come from what Arrmy already reads every 5 seconds. The .torrent comes from `/torrents/export` and is saved to the config folder when the download starts, so the link still works after the torrent is deleted.
- Indexer health from Prowlarr's history of the search; file details from Radarr's and Sonarr's media info.
- After the import, Arrmy checks Plex (or Audiobookshelf) until the item appears.
- A new table in Arrmy's database holds the steps.

Audiobooks come second. LazyLibrarian has no webhook and doesn't share its candidates or scores through its API, so their log covers the steps, the grabbed release and its .torrent, with LazyLibrarian checked every 30 seconds while a book is downloading. The candidate list comes later, if LazyLibrarian's own log can be read.

How long counts as stalled and how many tries before a Problem were settled and built on 2026-10-20: see Dead releases under Done. The Request Log takes that over and logs each step.

To decide: for TV, how Arrmy picks between a season pack and single episodes the way Sonarr does now.

### Series and Author Requests

Both change the rule that a Request is the smallest useful unit (one book), so that gets settled before either is built.

- **Series Requests.** Request every audiobook in a series at once, from any book in it.
  - How: LazyLibrarian already knows series (`getWorkSeries`, `getSeriesMembers`). Arrmy would want each book in the series and show progress per book.
  - To decide: one Request per book, or one for the whole series? What Remove does to books already downloaded? Are books added to the series later requested too (LazyLibrarian can subscribe to a series)?
- **Author Requests.** Request every audiobook by an author, and optionally their new releases.
  - How: LazyLibrarian adds the author with their books (`addAuthorID`), then Arrmy wants each one. For new releases the author is set to Active. LazyLibrarian's "New AudioBook Status" setting applies to every Active author, so Arrmy may need to want new books itself instead.
  - To decide: a cap, because prolific authors list 100+ works on OpenLibrary, including translations and collections. How to skip collections and duplicates. Whether Requesters can do this, or only the Admin.

### Other planned

- **More Media Types.** Music (Lidarr → Plex); Books and Periodicals (LazyLibrarian → Kavita); Comics (Kapowarr → Kavita); Manga (Mangarr → Kavita).
- **Better Movies + TV.** Anime routed to anime-tuned Radarr and Sonarr, Recyclarr quality profiles, Bazarr subtitles.
- **YouTube channels** (TubeArchivist), once its Plex plugin is confirmed to work.

## Not planned

- Usenet (SABnzbd) and Unpackerr.
- Requester reports, and replacing each app's own settings pages.
- Book wishlists (NYT bestsellers, Goodreads shelves): LazyLibrarian can do these itself.
