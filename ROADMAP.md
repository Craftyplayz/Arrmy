# Roadmap

What Arrmy does, how well each part is tested, and what comes next. Last checked against the server on 2026-10-22 (release v1.1.0-rc.41).

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
| Episode files | A show's Request page lists every episode of its requested seasons with its file, its state (Available, Downloading, Queued, Waiting for a release, Not aired yet…) and a progress bar, read live from Sonarr and qBittorrent every 5 seconds. (Until v1.1.0-rc.39 it waited for a drawer the page doesn't have and stayed on Loading files.) Files are matched to episodes by `S01E03`, else by Sonarr's own parser (`1x03`, anime numbering, double episodes). The poster's % covers every file of the Request, weighted by size. | Unit (the poster %), Live (Sonarr's parser). **Not yet live:** the panel itself. |
| Edit seasons | Add or remove seasons of a requested show. Removed seasons are deleted unless someone else requested them. | Fake. **Not yet live.** |
| Remove | Cancels a Request if nothing has downloaded; otherwise deletes the download and the files, keeping whatever another Request still wants. | Fake. **Not yet live.** |
| Discord message | Posts in #requests when a Request becomes Available (see Discord bot). | Fake. **Not yet live.** |
| Size limits | The Admin sets a maximum per movie, per hour of episode and per show (Admin → Size Limits). Bigger releases are never grabbed; a TV Request that could go over the show limit is refused with the estimate. | Fake. **Not yet live:** no limits are set on the server. |
| Request Log | Each Request's page (Requests → Request Log) lists every step with when it started and how long it took, a ticking timer on the step running now, and the total from Request to playable. Searching, then per release: Downloading (release, indexer, size and quality for the Admin; average speed, most seeders and peers), dead releases swapped, Importing (file, quality, resolution, codec, audio languages, subtitles), and Showing up in Plex until Plex lists it. Copy log copies it as text. The Admin can download each grabbed release's .torrent, saved when it was grabbed. Requesters see their own Request's steps without release names, indexers or errors. | Unit (the steps), Local (Radarr-shaped Grab and Download webhooks, the page as Admin and as another Requester). **Not yet live.** |
| Request Log: Arrmy's own movie search | Movies are added with Radarr's search off; Arrmy asks Radarr for every release (`GET /release`), logs them all with why each was turned down, and grabs the first acceptable one, which is Radarr's own pick. The Admin sees every release (Every release, and in Copy log) and how each indexer answered, from Prowlarr's history: results and time, or failed. Everyone sees how many were found and acceptable, or the commonest reasons none was; the log then waits for a release, which Radarr keeps watching for. Nothing acceptable for a released movie goes to #problems. If the search itself fails, Radarr searches by itself. Search again in the Admin view runs the same search. Stuck shows Arrmy's last search and why it found nothing. | Unit (the steps), Live (the API shapes: Radarr 6's releases with their rejections, Prowlarr's query history). **Not yet live:** a Request searched this way. |
| Request Log: edits and fixes | Seasons added or removed (in that Request's log only, with who), Search again and Try another release from the Admin view (with who; Try another release ends that download's step). | Unit. **Not yet live.** |
| Request page | Clicking a Request opens its own page: stat cards for who and when, status, Request to playable, size downloaded, average speed and best swarm; then the Request Log, the episode files (TV) and Manage (Edit seasons, Remove) on the left, and the title on the right: poster, facts (rating, genres, runtime, studio or network, dates), synopsis, IMDb, TMDB, TheTVDB and trailer links (Radarr's and Sonarr's lookups), and the first 12 of the cast with headshots (Radarr's credits for movies, Sonarr's `actors` for shows when its version has them). In the new look since v1.1.0-rc.39. | Unit (the totals, the title facts, the cast). Local (the layout, desktop and phone). Live since v1.1.0-rc.29 (audiobook details). **Not yet seen live:** movie and show cast. |
| English-only audio | At the same quality, Radarr and Sonarr pick a release with only English audio over MULTi, Dual Audio or another language, so files are smaller. Untagged releases count as the original language, so foreign films and anime are left alone. | Unit, Live (the rule is in Radarr and Sonarr) |

### The site

| Feature | What it does | Tested |
|---|---|---|
| Look | Picked 2026-10-22 from the Layouts mockups: the Sidebar dashboard's bluer greys and a menu down the left (on phones a top bar and a bottom tab bar), Requests as a table, Admin as two columns of panels with disks as bars, Settings and the Request page as panels. Search is the Search-first design: one centred column with a big search field. Live since v1.1.0-rc.38. | Local (every page at desktop and phone width), Live. **Not yet seen live:** Admin with real data. |
| Search: All | All, the default tab, searches movies, TV shows and audiobooks at once. Each result carries a Media Type tag, the searches' best hits take turns, and a search that is down only drops its own results. Movies, TV Shows and Audiobooks stay for finer control. Live since v1.1.0-rc.40. | Local (with Radarr and Sonarr down). **Not yet seen live:** all three answering. |
| Instant pages | The sidebar's pages are fetched in the background as soon as any page opens, and a page seen in the last 30 seconds opens from memory, so clicks show the page at once instead of Loading. Pages with live numbers refresh themselves straight after. Live since v1.1.0-rc.41. | Local (a production build: 40–240 ms a click) |
| Layouts | Fifteen static mockups of other ways Arrmy could look, on made-up data, each with Home, Requests, Admin and Settings tabs and phone pictures. Admin → Layouts. Kept for a future redesign or Themes. | Live |
| Install as an app | Arrmy installs to a phone's home screen (Chrome: Install app; iPhone: Share, Add to Home Screen) with its logo, opens full screen without the browser bar, and keeps the top bar clear of the notch. The icons are drawn in code from the logo. No offline mode and no notifications yet (see Phone app). | Local (a production build serves the manifest and icons as the right types). **Not yet tried on a real phone.** |
| Colour themes | Each person picks how Arrmy looks from a small menu in the sidebar: Dark blue (the current look), Light, Paper, Terminal or Violet, palettes taken from the Layouts mockups. Saved per person, so it follows them to any device, and set on the page by the server so there is no flash. The phone browser bar changes colour with it. | Unit (names validated; text, link and button contrast at least 4.5:1 in every theme). **Not yet live.** |
| Discover | A Discover page between Search and Requests: rows of posters for trending movies, trending shows and upcoming movies, and a genre picker (movie and TV genres) showing what is popular in one. Each poster shows its status if Arrmy has one and opens an item page with the poster, backdrop, overview, rating, genres, runtime or seasons, release dates, the first 12 cast, a trailer link and similar titles, plus the Request controls Search uses (a show needs a TheTVDB entry). Statuses come from one read of the Radarr and Sonarr libraries per page. Needs the optional TMDB_API_KEY; without it the page says the Admin needs to set it. | Local (the rules). **Not yet seen in a browser, nor against TMDB.** |

### Audiobooks

| Feature | What it does | Tested |
|---|---|---|
| Search | The Audiobooks tab searches OpenLibrary directly, in about a second. With an Audiobookshelf API key, books already in Audiobookshelf show as Available. | Unit, Fake, Live |
| Covers | A book's cover comes from the first source that has it: Audible's catalogue (the audiobook's own cover), Apple's audiobook catalogue, Google Books by ISBN (ignoring its 1 KB "no cover" placeholder), Amazon by ISBN-10, and OpenLibrary's cover server last, because it is often unreachable. The cover is saved with the Request; a Request saved with an OpenLibrary link gets a better one the first time its page is opened (tried once per server start if none has it). Audible's and Amazon's addresses are unofficial and may stop working. Audible and Apple covers are square, so the poster cards crop them. | Unit (ISBN-10). Live: the sources answer from the dev PC. **Not yet seen live:** covers on the server. |
| Request | LazyLibrarian adds the book, searches the indexers through Prowlarr and sends the best release to qBittorrent. | Fake, Live |
| AudioBook Bay | LazyLibrarian also searches AudioBook Bay, the main public source of audiobooks, which the general indexers mostly lack. The site answers 404 to LazyLibrarian's user agent, so its searches go through a small relay inside Arrmy (an internal port, never published, with a key in the address), which fetches the same pages as a browser. The Wiring points LazyLibrarian there once and searches again for every wanted audiobook. | Local (the relay, against a fake site). **Not yet live.** |
| Status | Requested → Downloading % → Available. Arrmy checks LazyLibrarian every 2 minutes. | Unit, Fake, Live |
| Filing | Every 10 minutes LazyLibrarian copies finished downloads to `media/audiobooks/Author/Title` (the torrent keeps seeding). Audiobookshelf picks the book up, and Discord gets a message. | Fake, Live (Dune, 2026-10-20). **Not yet live:** the Discord message. |
| Remove | Cancels the Request, or deletes the torrent. Once the book is in Audiobookshelf, deletes that copy too, but only one added after the Request was made, so books you already had are never touched. | Unit (the matching rule), Fake, Live during a download. **Not yet live:** after it's in Audiobookshelf. |
| Already have it | A requested audiobook Audiobookshelf already has (a copy from before Arrmy) becomes Available, and LazyLibrarian stops looking for it, so it isn't downloaded twice. A removed one that LazyLibrarian grabs anyway (its search was still running) is stopped and its torrent deleted, for a day after the Remove. | Unit (the removed-book rule). **Not yet live.** |
| Existing library | The Audiobookshelf already in use moved into the stack with all its books, users, progress and stats. | Live |
| Request Log | An audiobook's steps, from LazyLibrarian's history every 30 seconds: each release it grabbed (with the indexer and size), why one failed (LazyLibrarian's own reason), the download as for movies, filed, then In Audiobookshelf once Audiobookshelf lists it (without an API key, as soon as it's filed). A book Audiobookshelf already had says so. Editions show only the Request for now. | Unit (the steps), Live (the history's fields). **Not yet live.** |
| Editions | A Request can name an edition: a narrator ("Stephen Fry") or Full Cast (Dramatised matches too), also when the book itself is already requested or owned. LazyLibrarian knows no narrators and keeps one audiobook per book, so Arrmy finds these itself: it searches Prowlarr, takes the release with the most seeders whose name has the title and the edition, sends it to qBittorrent (category `editions`), and when it finishes hard-links it into `media/audiobooks/Author/Title (Edition)` and has Audiobookshelf scan. It also searches under the book's regional retitles (Philosopher's Stone is Sorcerer's Stone in the US, which Jim Dale reads; add pairs to `RETITLED` in `bookrules.ts` as they turn up), always with the same narrator. Order of preference: a seeded release of the book; else a seeded series pack by that narrator, of which only this book's files are downloaded (every other file is set to "do not download", and only the wanted ones are hard-linked); else, only if neither exists, a release nobody is seeding. The Request Log and Stuck say what the last search found ("17 releases found; 2 of this book with Jim Dale, none with seeders"). Nothing found: it searches again every 6 hours, and the Request shows in Stuck. Remove deletes the torrent and that folder. Packs of a whole series are skipped (that's for Series Requests). Needs the stack's `/data` mounted into Arrmy (in the compose file). | Unit (the matching rule, the retitles, packs and their order), Live (a Jim Dale pack with 17 of 202 files wanted, v1.1.0-rc.34). **Not yet live:** the filing into Audiobookshelf. |

### Admin

| Feature | What it does | Tested |
|---|---|---|
| Admin view | Problems (Missing, Failed Download, Failed Import) with one-click fixes: search again, or blocklist the release and try another. Also what's downloading, speeds, library counts, disk space and Requests by person. | Unit (the Problem rules), Fake, Live (the page). **Not yet live:** a real Problem and its fix. |
| Size Limits on the Admin page | The Settings page is gone (2026-10-22): its Size Limits panel is on the Admin page, the sidebar has no Settings, and `/settings` sends old links to `/admin`. | Local (type-check). **Not yet seen live.** |
| .torrent files | An Admin panel listing every .torrent Arrmy has saved, newest first, also those of removed Requests: release name, title, who asked, when it was grabbed, and Download. A search field filters by release name, title or hash as you type. One Admin-only download route by hash (40 hex characters) serves these and the Request page's links. | Local (type-check). **Not yet seen live.** |
| Downloading | Every movie, show and audiobook downloading, read straight from qBittorrent every 3 seconds without reloading the page: poster, title, who asked, progress, speed, time left, seeders and peers, and the state in words (Downloading, Stalled, Fetching file list, Queued, Paused, Checking). | Unit (the states), Live (v1.1.0-rc.23: a movie with its poster, who asked, speed and time left) |
| Stuck | Every Request that hasn't started downloading or has stopped, and why: Searching, Not released yet (with the cinema, digital or disc date), Nothing found (when it was last searched), or in qBittorrent but Stalled, Fetching file list, Queued, Paused or Error (how far it got, when it last moved, seeders). Audiobooks LazyLibrarian wants and hasn't found too. Once at the top: qBittorrent with no connection (the VPN), and indexers Prowlarr has switched off and until when. Stalled downloads keep "Try another release", Nothing found keeps "Search again". Missing moved here from Problems (Discord's #problems still gets it). | Unit (the rules), Live (v1.1.0-rc.24: the indexer notice, audiobooks not found with who asked), Local (stalled and queued torrents, through a fake qBittorrent). For about a minute after a redeploy Radarr's queue is empty, so a downloading movie can show as Searching. Movies: why the last search found nothing, from Arrmy's own search. **Later:** the same for shows, and each indexer's error text (Prowlarr's history doesn't keep it). |
| Dead releases | A torrent with no file list 5 minutes after it was added, or nothing downloaded after 15, is swapped for another release: Radarr and Sonarr blocklist it and search again; for audiobooks Arrmy deletes it, waits for LazyLibrarian to mark it Failed, then searches again (about 2 minutes). LazyLibrarian sometimes grabs the same dead release again; that counts as another strike. After 3 dead releases in a row for the same title, the third is left alone, it shows as a Failed Download Problem, and Discord @mentions the Admin (`DISCORD_ADMIN_ID`). Torrents in other qBittorrent categories, and paused ones, are never touched. The 5, 15 and 3 are the defaults; the Admin changes them in the Dead releases panel (changes go to #admin-log). | Unit (the rule), Fake. **Not yet live.** |
| Watch history | Tautulli, a new container in the stack, keeps Plex's watch history; init presets its API key (derived, like LazyLibrarian's) and Plex's address, so setting it up is one Plex sign-in in its own page (port 7660). Plays are matched to Requests through Plex's TMDB and TVDB ids. The Request page has a Watched panel: who watched it, when and how far, and for shows which episode of the requested seasons; Requesters see only their own plays. The Admin view has Watched in the last 30 days (top movies, shows and people) and Unwatched: Requests Available for 8 weeks or more that nobody has played, to remove by hand. #watched gets a summary every Sunday from 18:00 (the stack's `TZ`): who watched what that week. Tautulli also shows in #system and #updates like the other apps. Audiobooks play in Audiobookshelf, so they have none. | Unit (matching, unwatched, top plays, the summary and when it's due; init's config). **Not yet live.** |
| Collections and overlays | Kometa, a new container in the stack, runs nightly at 06:00 (the stack's `TZ`). Arrmy writes its config every 30 minutes when something changed (only once the Admin has signed in and `TMDB_API_KEY` is set, since Kometa needs the Plex token and TMDB's v3 key). Collections: Kometa's franchise collections (Marvel, Star Wars…) and a "Requested by <name>" collection per person in Movies and TV Shows, from Arrmy's Requests; one with no Requests left is deleted. Overlays: Kometa's resolution (4K and 1080p with HDR, HDR10+ and Dolby Vision), audio codec and, for shows, airing status (Airing, Returning, Canceled, Ended); and Arrmy's own badge, bottom left: New (added in the last 14 days), More coming (a show whose Request still waits for seasons) or Leaving soon (Unwatched, from Watch history). Kometa gets no Radarr or Sonarr, so nothing is ever downloaded by it; titles missing from a collection go into its report (`kometa/Movies_report.yml`, `kometa/TV Shows_report.yml`). Kometa shows in #updates. | Unit (the files Arrmy writes). **Not yet live.** **Later:** the Admin approving missing titles from the report, each becoming a normal Request. |

### Stack and deployment

| Feature | What it does | Tested |
|---|---|---|
| One stack | Arrmy, Plex, qBittorrent, gluetun (VPN), Prowlarr, FlareSolverr, Radarr, Sonarr, LazyLibrarian, Audiobookshelf, cloudflared and backups in one Portainer stack. | Live |
| Deploy from GitHub | GitHub Actions builds the image. Portainer deploys a release tag: `vX.Y.Z` runs `arrmy:X.Y.Z`. | Live |
| One-command release | `bash scripts/release.sh` makes the release commit off main (compose pinned to the new image) with a temporary index, tags it, creates the GitHub release, waits for the image, then points the Portainer stack at the tag and redeploys it with its variables kept. It reads `PORTAINER_URL` and `PORTAINER_TOKEN` from `.env`, and skips the certificate check only for a LAN address. Giving it a version resumes an interrupted release. A redeploy restarts the whole stack, so qBittorrent shows "fetch failed" for a minute. | Live (rc.29 to rc.35) |
| Version in the footer | The page footer shows the running version and links to its GitHub release (`ARRMY_VERSION`, baked into the image; `latest` links to the releases list). | Live |
| First-run setup | A one-shot `init` container creates the folders and writes qBittorrent's and LazyLibrarian's settings the first time, never overwriting them. | Unit, Live |
| Wiring | Arrmy connects the apps itself: root folders, download clients, its webhook, Prowlarr → Radarr, Sonarr and LazyLibrarian, the FlareSolverr proxy, size limits and English-only audio. It retries every 30 seconds until everything is connected, and creates the Plex libraries. | Fake, Live |
| Bulk indexers | `scripts/add-indexers.mjs` adds every public English indexer that passes Prowlarr's test. | Live (25 indexers) |
| autobrr | A container in the stack. Arrmy makes its account (`admin` / `QBIT_PASSWORD`) and API key on first start and adds Radarr, Sonarr and qBittorrent as its clients; IRC networks, trackers and filters stay the Admin's own (private trackers). | Not yet deployed |
| Tdarr | A container (server with its internal node) re-encoding `media/` to H.265 on the CPU, in place; it can't see `torrents/`. Its library schedule (01:00 to 07:00) and plugins are set once in its page: README. | Not yet deployed |
| Configurable ports | Every port is a variable. Defaults: 7654–7659, Plex 32400, Audiobookshelf 13378. | Live |
| VPN | PIA with port forwarding. qBittorrent only connects through the VPN; Prowlarr and FlareSolverr reach indexers through it. | Live |
| Seeding | Every torrent seeds, not just a few at a time. | Live (Dune seeds after filing) |
| Config backups | Every app's settings copied nightly and kept for a week (restore steps in the README). | Live (a backup ran and includes Audiobookshelf's database). **Never tried:** a restore. |
| Cloudflare Tunnel | Public addresses for Arrmy and the apps. | Live |
| Media files on your PC | Through the server's own Samba share, so the stack doesn't run one. | Not part of Arrmy |

### Discord bot

A Discord app with no live connection: Arrmy calls Discord's API with the bot's token, and Discord sends slash commands and button clicks to `https://arrmy.<domain>/api/discord`, checked against the app's public key. It reports, and the Admin can reply to the doctor in a Problem's thread (ADR 0004); an update is still something you start in Portainer (ADR 0001). Setup in the README. Without the bot, `DISCORD_WEBHOOK_URL` still gets #requests and #problems.

Every message is a card in DESIGN.md's colours (green for Available and success, red for failures, --info for Downloading and notes, the accent for something to act on) with art beside it: the poster or cover from Radarr, Sonarr or OpenLibrary, a Plex avatar, a committer's GitHub avatar, or the app's icon. The title links to the title's page on TMDB, TVDB or OpenLibrary, and the author line to the app on this server. No emoji; British English.

| Feature | What it does | Tested |
|---|---|---|
| Channels | An Arrmy category with #requests, #downloads, #downloaded, #problems, #admin-log, #system, #updates and #activity, made by the bot (again if one is deleted). Links go to each app's public address (`PUBLIC_DOMAIN`). | Fake |
| #requests | New Requests, edits and removals (who did it, and whose Request it was), Requests refused for the Size Limit, and Available. | Messages: Fake. **Not yet run:** the calls from Arrmy's pages. |
| #downloads | One card per download, titled with the movie, show or book (the release name small underneath), updated every 5 seconds: a smooth progress bar in DESIGN.md's --btn → --accent gradient (its 50 pieces are drawn by Arrmy and uploaded once as the bot's own emoji), then speed, time left, seeders and who asked. When it finishes, the card moves to #downloaded with how long it took; a removed torrent's card is deleted, so #downloads only ever shows what's downloading. Discord allows about 5 edits per 5 seconds in a channel, so each round edits the 4 that waited longest. | Unit, Fake |
| #problems | A new Problem once it has lasted 20 minutes (Arrmy fixes most stalled downloads within 15), or at once when Arrmy raised it after 3 dead releases. @mentions the Admin. Also each dead release Arrmy swaps. | Fake |
| The doctor | Each Problem #problems announces goes to the `doctor` container, where Claude Code (on the Admin's Claude subscription, `CLAUDE_CODE_OAUTH_TOKEN`) reads Radarr's, Sonarr's, Prowlarr's and qBittorrent's APIs to find the cause. It can run only the safe fixes in `scripts/doctor.mjs` (search again, another release, test indexers, restart an app, recheck or start a torrent) and posts Cause, What I did and What you need to do under the Problem. Once a day per Problem, at most `DOCTOR_DAILY` (10) a day. Not LazyLibrarian or Arrmy's own log yet. Its first look posts every release found, numbered, and the Admin can reply in the thread (Replying to the doctor in Problems, under Later). | Unit (the limits, the fixes' checks), Local (replies). **Not yet live.** |
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

### Discord bot rework

Asked for 2026-10-22, choices settled 2026-10-23. **Built 2026-10-23, not yet deployed or run against Discord** (Unit only). A Request thread is per title, not per person: a second Request for the same title posts in the first one's thread. Instead of posting everything into channels, the bot opens a forum thread for each thing and posts everything about that thing inside it. It stayed read-only (ADR 0001) until replying to the doctor (below), but it will likely get more buttons later (Search again, Approve…), so each thread's id is stored against its Request, Problem or media item, so that later code can find it.

The new Arrmy category:

| Channel | Kind | Holds |
|---|---|---|
| #downloading | Channel | Today's #downloads: one live card per download, updated every 5 seconds. A finished card is deleted (its stats go to the Request's thread). |
| #weekly-summary | Channel | Today's #watched: who watched what that week, every Sunday from 18:00. |
| Requests | Forum | One thread per Request. |
| Activity | Forum | One thread per movie, show or book someone plays. |
| Problems | Forum | One thread per Problem. |
| Admin | Forum | One thread per subject, tagged **Admin log**, **System** or **Updates**. |

These replace #requests, #downloads, #downloaded, #problems, #admin-log, #system, #updates, #activity and #watched. The bot leaves the old channels alone, and the Admin deletes them by hand. Without the bot, `DISCORD_WEBHOOK_URL` keeps working as it does today.

Who sees what: Problems and Admin are the Admin's only. Requests, Activity, #downloading and #weekly-summary are for everyone. Only the bot opens threads; anyone who can see a Requests or Activity thread can reply in it. Every new post moves its thread back to the top.

Every forum thread's first message is a full card with the cover art (Radarr, Sonarr, Plex or OpenLibrary) as an attached image, which Discord shows as the thread's preview. Later posts in the thread are compact cards: DESIGN.md's colour, one line and the details, without the cover or author line again. Links go through `publicUrl` (`*.craftyplayz.com`).

**Requests forum.** The thread is titled with the media's name (`Dune: Part Two (2024)`). Tags: Movie, TV or Audiobook, plus one status tag the bot swaps: **Requested**, **Downloading**, **Available**, **Removed**. The first card's title links to the title's page in Arrmy (`arrmy.craftyplayz.com/discover/<type>/<id>`), and its author line names the app but links to Arrmy's Requests page, since Radarr, Sonarr and LazyLibrarian only open for the Admin. The requester shows with their Plex username and avatar. Inside, in order:

1. Created: who requested it and what (for a show, which seasons).
2. Search: the 10 best releases found, with size, seeders and why each was turned down, then how many more there were. This shows to everyone in Discord, even though the Request page hides it from Requesters.
3. Picked: the release grabbed, with a link to the Request's page in Arrmy (`/requests/<id>`), where the Admin sees its torrent files.
4. Downloaded: how long it took, average speed and file size.
5. Importing into Radarr, Sonarr or LazyLibrarian.
6. Available, with a link straight to the title: Plex (`plex.craftyplayz.com/web/index.html#!/server/<machineId>/details?key=/library/metadata/<ratingKey>`) or Audiobookshelf (`books.craftyplayz.com/item/<id>`). The thread is tagged **Available** and stays open; Discord archives it after a week without posts, and a new post (a later season) brings it back.

A show gets one thread. Each season pack or episode torrent gets its own Search, Picked and Downloaded posts, and each season gets its own Available. Edits (seasons added or removed), dead releases swapped, and a refusal for the Size Limit go in the same thread. Problems don't: they stay in the Problems forum. A removed Request posts who removed it, is tagged **Removed**, then the thread is archived. The requester isn't @mentioned when it's Available until per-user notifications (Later, item 5) link Plex users to Discord users.

**#downloading.** Each card's title links to its Request's thread.

**Activity forum.** One thread per movie, show (all episodes together) or book, opened the first time someone plays it, even if it was never requested. Tagged Movie, TV or Audiobook. A play gets a card once it passes 1 minute: who, which episode or chapter, which device, and the start time. When playback stops, the same card is edited to add the end time and how long they watched. If the same person comes back to the same episode or book within 30 minutes, that card is edited again rather than a new one posted. Plex comes from its sessions (with Tautulli for the watched time), Audiobookshelf from `/api/sessions`, which gives the user, device, start time and time listened. Arrmy already polls both every 30 seconds for #activity.

**#weekly-summary.** Today's #watched, with each title linking to its Activity thread.

**Problems forum.** A thread opens once a failed download or import has lasted 10 minutes; a Missing one opens as soon as it counts as Missing (10 minutes after the Request or the show was added, 24 hours after an episode aired), and one Arrmy raised after 3 dead releases at once. The doctor starts 10 minutes after the thread opens (at once for the dead-release ones). Set 2026-10-23. It is titled `<Media Type> - <title> - <issue>`, e.g. `Audiobook - Harry Potter and the Chamber of Secrets - no valid release found`, with the cover. Discord allows 100 characters, so a long media title is cut short with `…`, keeping the type and issue whole. Tags: **Open**, **Doctor working**, **Needs you**, **Resolved**.

- When the doctor starts, it posts that it's looking into the Problem. Then it posts each step: **Checked** (each `get`, e.g. `radarr /queue`) and **Fixed** (each `fix`, e.g. `retry radarr 412`), from Claude Code's `stream-json` output. Last comes its answer: Cause, What I did, What you need to do, and whether it solved the Problem.
- Not solved: the thread is tagged **Needs you** and the Admin is @mentioned (`DISCORD_ADMIN_ID`). This replaces today's @mention on every new Problem.
- When the Problem goes away, the bot posts "Issue resolved", tags the thread **Resolved** and archives it, without locking it, so the Admin can still add notes. If the same Problem comes back, the same thread reopens.

**Admin forum.** One thread per subject, kept over time.

- **System**: one thread each for Radarr, Sonarr, Prowlarr, qBittorrent, Audiobookshelf, LazyLibrarian, Plex and the other apps (down, back, restarted, health warnings), plus VPN, Disk and Backups.
- **Admin log**: one thread each for Size Limits, Dead releases settings, One-click fixes, each app's settings changes, Plex and Audiobookshelf access, and Sign-ins to Arrmy.
- **Updates**: one thread for Arrmy releases and one per app's new versions.

The @mentions stay as today: an app down, a disk, a backup, an app update and a full Arrmy release, each in its own thread.

**Slash commands** answer as they do today.

**First run.** The bot opens a thread for every Request ever made, Available ones included, filled with what Arrmy has kept: Created, edits, removals and Available. Search, Picked and Downloaded are skipped, since nothing was stored for them. Open Problems get their threads the same way.

How: forum channels (type 15), threads opened with `POST /channels/<forum>/threads` and `applied_tags`. Each thread is its own channel, so Discord's rate limit of about 5 edits per 5 seconds applies to each thread separately, and only #downloading still needs to take turns. The `botrules` tests cover which thread and tag each event goes to.

About 2–3 days (the first-run backfill and the status tags add most of a day). The order to build it in: forums and thread storage, Problems (it absorbs **The doctor's steps in Discord** under Other planned), Requests, Admin, Activity.

**Later:** a page on the site with the weekly summary.

### Replying to the doctor in Problems

Asked for 2026-10-23. **Built 2026-10-23, not yet deployed or run against Discord** (Unit, and Local: the whole flow against a fake Discord, Radarr, qBittorrent, Arrmy and Claude Code). The first step away from a read-only bot (ADR 0004). When the doctor has looked into a Problem and couldn't solve it (the thread is tagged **Needs you**), the Admin just types a reply in that thread, in plain English: no slash command, no @mention, no special words. The doctor carries on from where it stopped and answers in the same thread. A reply can be a question ("why did the first two releases die?"), an instruction ("download number 4", "search again tomorrow", "leave it, I'll sort it myself") or extra facts ("the indexer's login changed, I've fixed it in Prowlarr").

**Seeing the reply without a live connection** (`replies.ts`). Discord only sends Arrmy interactions (slash commands, buttons), never ordinary messages, so the bot keeps having no live connection and reads the threads instead:

- Every 20 seconds, for each Problem thread tagged **Needs you**, Arrmy reads `GET /channels/<thread>/messages?after=<last seen>`. Usually that's zero or one thread, so zero or one call.
- Only messages whose author is `DISCORD_ADMIN_ID` count; the bot's own and anyone else's are skipped. What the doctor last read is kept per thread with the Problem (the `doctor:threads` setting), so a restart doesn't answer the same reply twice.
- A reply goes once the Admin has stopped typing for 20 seconds, so several messages in a row go as one. An @mention of the bot is taken out.
- Discord hides what a message says from bots unless the app has the **Message Content Intent** switched on (README, Discord step 1). Without it the text comes back empty: Arrmy posts once in the thread that the switch is off, and a reply that @mentions the bot still works.
- The Gateway was considered (ADR 0004): replies would arrive at once, but it means a connection that's always open. A `/reply` command would have saved about half a day, but means remembering a command.

**What happens with the reply.**

1. Arrmy shows "Arrmy is typing…", tags the thread **Doctor working** and posts "Got it, looking at this again."
2. It sends the doctor (`POST /reply` on port 3002, same token) the Problem, the Admin's words and what the bot posted in the thread since the doctor last looked (a dead release swapped and the like), as news, not instructions. The doctor's own posts and the list of releases aren't sent back to it.
3. The doctor carries on the same Claude Code conversation it had for this Problem (`claude -p --resume <session id>`), so Claude remembers what it checked and why it gave up. The session ids are kept per Problem in the doctor's `/config/sessions.json`, beside the conversations. If that conversation is gone, it starts again from the Problem and the first prompt.
4. The steps (**Checked**, **Fixed**) and the answer are posted as before. `Solved: yes` goes back to **Open** until the feed marks it **Resolved**; no goes back to **Needs you**, without another @mention. The Admin can reply again, as many times as they like.
5. Replying while the doctor is still working waits until the run ends, then goes as the next reply. A thread tagged **Open** takes replies for an hour after the doctor said solved ("no, it's still stuck"); **Resolved** never does.
6. Arrmy restarting mid-run loses the answer: the thread goes back to **Needs you** with a note to reply. Problem threads from before this was built start taking replies from the first message after the update.

**What the Admin can ask for.** Everything the doctor does by itself, plus a few it only does on a run answering the Admin, since it shouldn't decide them alone (`REPLY_FIXES` in `scripts/doctor.mjs`):

| Fix | What it does |
|---|---|
| `grab <number>` | Downloads that release from the Problem's numbered list (below), e.g. "download number 36". |
| `later <minutes> [note]` | The doctor looks at this Problem again then by itself ("check again tomorrow"), from 5 minutes to a week. In place of the planned `snooze`: stopping Arrmy raising a Problem would hide it, where this follows it up. |
| `unmonitor <radarr\|sonarr> <ids>` | Stops Radarr or Sonarr looking for a movie or episodes. |
| `remove-request` | Removes this Problem's Request as the Remove button does (for a show, just this season), deleting its files unless another Request wants them. Asks first. |
| `delete-torrent <hash>` | Deletes a torrent and its files from qBittorrent. Asks first. |

Plus `list-releases`, on any run: search again and post a new numbered list. Two checks keep the reply-only fixes to reply runs: the fix asks the doctor's server what it's working on (`GET /run`, only from inside its container), and Arrmy's doctor API refuses them unless it has a reply run open for that Problem. Every fix still checks its arguments, and there is still no shell, no file edits and no Docker (ADR 0001).

**Every release found, numbered** (`releaselist.ts`). When the doctor first looks into a Problem by itself, the thread also gets a numbered list of every release found for the title, so the Admin can reply "download number 36", or anything else. Arrmy's own code builds it, not Claude, so it's exact and costs no tokens however long it is:

- Movies and TV: Radarr's or Sonarr's own search for the movie or the season (`GET /release?movieId=`, or `?seriesId=&seasonNumber=`, as Interactive Search in their pages), with why each release would be turned down.
- Edition audiobooks: everything Arrmy's Edition search finds on AudioBook Bay and Prowlarr. A book LazyLibrarian wants: the same Prowlarr search LazyLibrarian makes.
- One line each: number, release name, size, seeders, where it came from, quality, and why it was turned down (or "tried already, never started" for a release that died). Acceptable first, then turned down, then dead; most seeders first within each, not Radarr's or Sonarr's own order (kept 2026-10-24).
- A first card says how many were found and how to pick one, with the whole list attached as a text file, always, however short. Then the releases on compact cards, as many lines as fit in each, the first 200.
- "Number 36" always means the latest list; `list-releases` makes a new one with new numbers. Claude reads it with `get arrmy /releases` only when it needs to.
- Grabbing goes through `POST /release`, so Radarr or Sonarr track and import it as usual (they forget a search's releases after about 30 minutes, so an old number is searched for again first), or through Arrmy's own Edition download for Editions (a series pack downloads only this book's files). No button: grabbing deletes nothing.
- A book LazyLibrarian wants (chosen 2026-10-24): LazyLibrarian only files a download it grabbed itself, so Arrmy downloads the pick and files it into Audiobookshelf as `Author/Title`, the way it does Editions, and LazyLibrarian stops looking for the book. The Request shows Downloading and then Available from Arrmy's download. If the pick's torrent is deleted before it finishes, LazyLibrarian wants the book and searches again; a second pick replaces the first; removing the Request deletes the pick and its files. Unit (unchanged), Local (against a fake LazyLibrarian and qBittorrent; the filing itself is the Editions' own).

**Asking before it can't be undone** (`confirm.ts`). `remove-request` and `delete-torrent` post what they would do ("Delete the torrent Dune.2021.2160p from qBittorrent, with its files?") with **Go ahead** and **Cancel** buttons. Discord sends the click to `/api/discord`; only the Admin's click counts, anyone else is told so, and one left for a day expires. Replying instead of clicking cancels it, and the reply says what to do now. The bot's first buttons.

**Limits.** Replies don't count towards `DOCTOR_DAILY`; they have their own `DOCTOR_REPLIES` (30) a day, after which the thread says so. Runs still go one at a time.

**Safety.** The Admin's words are the only instructions: release names, logs, API answers and the bot's cards are data, and the prompt says so; the fixes' checks are the real limit, whatever the text says.

**Later:** the same in Requests threads for the Admin ("get this in 4K instead"), and in Admin threads ("restart it"), once Problems has been used for a while. Starting replies to long investigations from a short summary was considered and turned down (2026-10-24): replies carry on the whole conversation.

### Request Log

Built (see Done): the log from Radarr's and Sonarr's webhooks, qBittorrent and Plex; Arrmy's own movie search with every release and indexer health; edits and one-click fixes; audiobooks; #problems when a movie search finds nothing acceptable (dead releases were already there). Still to come: Arrmy running TV searches (waits on the season pack question below), refused Requests (they have no Request to hang a log on yet), and removals (the log goes with the Request).

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

### Resolution preference

Chosen 2026-10-21. A Request (or a person's default) names a preferred resolution, and Arrmy walks down a ladder until a release is acceptable: 4K, then 1440p, then 1080p, then 720p.

- Each rung gets a full search first (Arrmy's own movie search already lists every release and why it was turned down). Only when nothing acceptable exists at that resolution does it drop to the next, and the Request Log says which rung it is on.
- Landing on 720p does not download by itself: it becomes a Problem, so the Admin can approve that copy or find a better one by hand. Whether Arrmy keeps watching the higher rungs afterwards (and upgrades if one turns up) is still to decide.
- A resolution blocklist sits next to it: resolutions or release groups never to grab, per Request or globally.
- To decide: whether the ladder is per Request or a per-person default; how it maps onto Radarr and Sonarr quality profiles; TV, which waits on the season pack question above.

### Episode Requests

Asked for 2026-10-22. Request chosen episodes of a show, not only whole seasons: a single episode someone missed, or the last few of a season.

- In the TV drawer, each season opens to its episodes with a checkbox each; ticking the season still requests all of it.
- Edit seasons becomes Edit episodes, with the same rule as now: removed episodes are deleted unless someone else requested them.
- The Request page's Episodes panel, the poster's %, Available and Remove cover only the requested episodes.
- How: Sonarr already monitors episode by episode (`PUT /episode/monitor`), then searches just those (`EpisodeSearch`). The Size Limit per hour of episode already applies to single episodes.
Settled 2026-10-22:

- **One Request per show.** The chosen episodes are stored on the show's Request, as its seasons are now, so the Requests list shows one row per show and Edit, Remove, the Episodes panel and the Request Log keep working per Request. Requesting more episodes later adds them to the same Request.
- **Season packs.** When the wanted episode only comes in a pack, the pack is used and only that episode is kept:
  - A pack of separate files: only the wanted episode's files are downloaded, every other file is set to "do not download" in qBittorrent (as Editions do with audiobook series packs).
  - A pack inside an archive (zip or rar): the whole archive is downloaded, Arrmy extracts the wanted episode, and the archive and the rest are deleted. Arrmy does this itself; Unpackerr stays under Not planned. The torrent is removed with the archive, so it stops seeding.
- **Unaired episodes can be requested.** Sonarr watches for them and they download when they air; until then they show as Not aired yet, as whole seasons already do.

Still to decide: ties into the season pack question under Request Log (how Arrmy picks between a pack and single episodes).

### Requester features

From the Seerr and Requestarr comparison, 2026-10-21. In this order:

1. **Per-user approval, quotas and permissions.** Auto-approve stays the default. A per-person "Approve first" switch, and a quota such as N movies a week, protect the disk and the VPN.
2. **Discover and item pages.** Trending, upcoming, genres, cast, ratings, trailers and similar titles, from TMDB. The Request page's title side (see Done) can share this data. **Built 2026-10-22** (see The site under Done); movies and TV only. **Not yet seen in a browser.**
3. **Library scan.** Anything Plex already has shows Available without a Request (audiobooks already do this).
4. **Plex Watchlist auto-request.** Whatever a person adds to their Plex watchlist is requested for them.
5. **Per-user notifications.** A Discord DM or email when your Request is Available, with an opt-out.
6. **Title blocklist.** Titles nobody can request.
7. **4K as its own Request, and several Radarr and Sonarr instances** (extends anime routing under Other planned).

A form for Requesters to report issues ("this episode has no audio") was considered and dropped on 2026-10-21: see Not planned. Arrmy's own reporting to the Admin stays.

### Search rework

Asked for 2026-10-21. The All tab (searching every Media Type at once) is built: see The site under Done. Still to come, so Search works like Overseerr's:

- Suggestions appear as you type, and only for the Media Type tab you are on (Movies shows only movies, and the same for TV, Books and every later type). Never people or companies mixed in. **Built 2026-10-22:** up to 8 titles after a 0.3 second pause in typing (2 letters or more), with Media Type, year and status; arrow keys and Enter, or a click, search for that title. All suggests from every Media Type. Tested Local (the route, against a fake Radarr). **Not yet seen in a browser.**
- A small control on each tab switches what is searched, so a person can look for something other than a title:
  - **Movies and TV:** actor, director, studio or company (Marvel, Disney).
  - **Books and audiobooks:** individual book, series, author.
  - **Comics:** individual issue, series, publisher, character (every comic with Spider-Man in it).
  - **Built 2026-10-22** for Movies, TV and Audiobooks: a row under the tabs (Title, Actor, Director, Studio; Book, Series, Author), the `by` in the address. Movies and TV ask TMDB for the person's 20 most popular titles (talk and news shows left out) or the companies' 20 most popular, then Radarr and Sonarr for each one's status, so they show with Request buttons as usual; a show with no TVDB id is left out. Without `TMDB_API_KEY` Movies and TV offer only Title. Books by author use OpenLibrary's author search; by series its series field, which only some books have (Discworld finds 23 of 41), keeping the main author's books, oldest first. With `HARDCOVER_TOKEN`, by series uses Hardcover's series list instead (main books in reading order, each looked up in OpenLibrary for its BookID), since OpenLibrary leaves books like The Lord of the Rings untagged; OpenLibrary's field stays the fallback (added 2026-10-22, not yet run against Hardcover). Suggestions follow the choice: people (with what they're known for), companies or authors; none for series. Limits: a name goes to TMDB's best-known person of that name; owned audiobooks found by series or author show LazyLibrarian's status only; a refused TV Request comes back to a title search. Tested Local (the rules); **not yet run against TMDB or seen in a browser.**
- Comics need Kapowarr (see Other planned); the other tabs can be built first.

### Admin: .torrent files

**Built 2026-10-22** (see Admin under Done). Asked for 2026-10-22. A panel on the Admin page listing every .torrent file Arrmy has ever saved (`torrents/<hash>.torrent` in its config folder), including those of removed Requests, whose pages are gone.

- Each row: the release name and title (from the Request Log's grabbed entries), who asked, when it was grabbed, and a Download link. A file with no log entry left shows by its hash.
- A search bar filters by release name, title or hash as you type.
- How: a new Admin-only download route by hash (40 hex characters, as the Request page's route checks), since today's route only serves files of a Request that still exists.
- About 1–2 hours.

### Settings merged into Admin

**Built 2026-10-22** (see Admin under Done). Asked for 2026-10-22. The Settings page goes away: Size Limits (its only panel) moves into the Admin page, the sidebar loses Settings, and `/settings` redirects to `/admin` so old links still work. Everything planned under Settings page below is built into the Admin page instead. About 30–60 minutes.

### Settings page

These become panels on the Admin page (see Settings merged into Admin above), next to Size Limits. Candidates, in the order they'd help most:

1. **Resolution preference** and its blocklist (see above).
2. **People:** who has access, and per person: approve first, quota, notifications.
3. **Dead releases:** built 2026-10-22. The 5 and 15 minute limits and the 3-strike rule are settings on the Admin page (defaults unchanged).
4. **Discord:** bot status, which channels exist, who gets @mentioned, which slash commands everyone can use.
5. **Connected apps:** built 2026-10-22. Each app up or down with its version, whether the Plex token, Audiobookshelf API key, TMDB key and Discord bot are set, and the Audiobookshelf and TMDB keys can be entered on the Admin page (the environment variable wins when both are set).

Also possible: English-only audio on or off, backup status and last run, and the public address.

### Phone app

Chosen 2026-10-21. An installable app for Requesters and the Admin: first as a PWA of the existing site (home-screen icon, full screen, push notifications for Available and Problems), a native app only if the PWA falls short. Needs the Requester features above for push to be worth having.

- **Built:** the install part (manifest, icons, iOS home-screen meta, safe-area insets on the phone top bar). No service worker, since Chrome installs without one.
- **To come:** push notifications (needs a service worker for them, and a notifications permission prompt in Settings).

### Themes

Possible add-on, asked for 2026-10-22. Let each person pick how Arrmy looks, from the styles mocked up on the Layouts page (Admin → Layouts):

- **Colour themes:** built 2026-10-22, see Colour themes under Done. Five palettes (Dark blue, Light, Paper, Terminal, Violet), picked per person.
- **Full layouts** (Board, Chat feed and so on): about a day each, since every one needs its own working Search, Requests, Admin and Settings pages, and every later feature built into each.

The current look (Sidebar dashboard colours and pages, Search-first Home) was picked on 2026-10-22.

### Other planned

- **More Media Types.** Music (Lidarr → Plex); Books and Periodicals (LazyLibrarian → Kavita); Comics (Kapowarr → Kavita); Manga (Mangarr → Kavita).
- **Better Movies + TV.** Anime routed to anime-tuned Radarr and Sonarr, Recyclarr quality profiles, Bazarr subtitles.
- **YouTube channels** (TubeArchivist), once its Plex plugin is confirmed to work.
- **The doctor's steps in Discord** (chosen 2026-10-22, about 30 minutes; now part of the Discord bot rework's Problems forum). Today only Claude's final answer reaches #problems, and the container log says only "looking into it". Planned: post "Claude is looking into this…" when a run starts, then edit that card with the answer plus **Checked** (each `get` it made, e.g. `radarr /queue`) and **Fixed** (each `fix` it ran, e.g. `retry radarr 412`), so a fix can be confirmed rather than taken from Claude's summary. The doctor would record steps from Claude Code's `stream-json` output. An Admin panel with run history was considered and left for later.
- **The doctor handles stuck Editions and a blocked VPN server** (chosen 2026-10-22). Seen live: the Andy Serkis Lord of the Rings Editions found nothing because AudioBook Bay never answered (the home connection times out; the VPN's Riga server was blocked too), yet nothing was raised: an Edition with no match isn't a Problem, and the doctor can't see Editions or AudioBook Bay. Reconnecting the VPN (new server, Montréal) fixed it by hand. Built (Arrmy side): each Edition search now records whether AudioBook Bay answered, and an Edition still unmatched an hour after its Request is a Missing Problem that says so ("AudioBook Bay didn't answer (fetch failed); Prowlarr found 19 releases, none of this book read by Andy Serkis."), with **Search again** on the Admin page; an audiobook LazyLibrarian still wants with nothing snatched an hour after its Request is one too. The doctor gets an internal API on the relay's port (`/doctor/editions`, `/doctor/abb?s=`, `POST /doctor/editions/<id>/search`, with its token). Still planned: the doctor using that API, and **reconnect the VPN** as a safe fix (gluetun's control server, which needs `HTTP_CONTROL_SERVER_AUTH` set up first: it answers 401 today).

### Possible integrations

Chosen 2026-10-22 from a longer list, in the order they'd be built: cheap ones that others build on first (Tautulli's watch history feeds the Request page, the Admin view and Discord; watchlists share their code with the Plex Watchlist auto-request), Tdarr last since it encodes on the CPU only. Left off: Maintainerr, cross-seed, other notification apps, Home Assistant, and Jellyfin or Emby. FlareSolverr is already in the stack (Prowlarr sends indexers tagged `flaresolverr` through it), and the Admin runs Uptime Kuma separately.

1. **Tautulli.** Built 2026-10-22: see Watch history under Done. Watch history from Plex, used for:
   - The Request page: who has watched it, and when.
   - The Admin view: most watched, who watches what, Requests nobody has watched.
   - Discord: a weekly summary of what got watched.
   - Unwatched Requests: anything nobody has watched after a few weeks is listed for the Admin to remove by hand. Nothing is deleted by itself.
2. **Watchlists and lists** from Trakt, Letterboxd and IMDb, checked every few hours, with anything new requested. Size Limits (and quotas, once built) apply as if it were clicked in Arrmy. All three ways are wanted:
   - Each person connects their own account in Settings, and what they add to their watchlist becomes their Request. The Admin can turn this off for Requesters, leaving it to the Admin only.
   - The Admin pastes public lists (IMDb Top 250, someone's Letterboxd list): everything on them is requested in the Admin's name, and new entries as they appear.
   - How: Trakt has an API with sign-in. Letterboxd (movies only) and IMDb have none, so their public list pages or RSS are read instead.
   - Same idea as the Plex Watchlist auto-request under Requester features, so they share the code.
3. **Kometa** (formerly Plex Meta Manager). Built 2026-10-22: see Collections and overlays under Done; still to come is the Admin approving missing titles. In Plex: franchise collections (Marvel, Star Wars), a "Requested by …" collection per person, quality overlays on posters (4K, HDR, audio) and status overlays (New, Leaving soon, the Request's status). Titles missing from a collection are not downloaded by themselves: they show for the Admin to approve, and an approved one becomes a normal Request.
4. **Podcasts** (Audiobookshelf). A Podcasts tab in Search; a Request subscribes in Audiobookshelf, which then downloads new episodes by itself.
5. **YouTube playlists** (TubeArchivist, with YouTube channels under Other planned). A Request subscribes to the playlist, and TubeArchivist's scheduled rescan downloads new videos as they are added.
6. **autobrr.** Built 2026-10-22: see Stack and deployment under Done. Grabs new releases the moment a tracker announces them on IRC, instead of waiting for Radarr's and Sonarr's next RSS check. Works best with private trackers.
7. **Tdarr.** Built 2026-10-22: see Stack and deployment under Done. Re-encodes big files to H.265 to save disk space. The server's Ryzen 5 5500 has no graphics, so it encodes on the CPU (about as long as the film or longer, for 1080p) and runs overnight only, so Plex isn't slowed.

## Not planned

- Usenet (SABnzbd) and Unpackerr.
- Requester reports, and a form for Requesters to report issues (dropped 2026-10-21: they ask the Admin directly). Arrmy still reports problems to the Admin by itself: Problems, Stuck and #problems. And replacing each app's own settings pages.
- Book wishlists (NYT bestsellers, Goodreads shelves): LazyLibrarian can do these itself.
