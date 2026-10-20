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
| Edit seasons | Add or remove seasons of a requested show. Removed seasons are deleted unless someone else requested them. | Fake. **Not yet live.** |
| Remove | Cancels a Request if nothing has downloaded; otherwise deletes the download and the files, keeping whatever another Request still wants. | Fake. **Not yet live.** |
| Discord message | Posts when a Request becomes Available. | Fake. **Not yet live:** `DISCORD_WEBHOOK_URL` is empty on the server. |
| Size limits | The Admin sets a maximum per movie, per hour of episode and per show (Settings). Bigger releases are never grabbed; a TV Request that could go over the show limit is refused with the estimate. | Fake. **Not yet live:** no limits are set on the server. |
| English-only audio | At the same quality, Radarr and Sonarr pick a release with only English audio over MULTi, Dual Audio or another language, so files are smaller. Untagged releases count as the original language, so foreign films and anime are left alone. | Unit, Live (the rule is in Radarr and Sonarr) |

### Audiobooks

| Feature | What it does | Tested |
|---|---|---|
| Search | The Audiobooks tab searches OpenLibrary directly, in about a second. With an Audiobookshelf API key, books already in Audiobookshelf show as Available. | Unit, Fake, Live |
| Request | LazyLibrarian adds the book, searches the indexers through Prowlarr and sends the best release to qBittorrent. | Fake, Live |
| Status | Requested → Downloading % → Available. Arrmy checks LazyLibrarian every 2 minutes. | Unit, Fake, Live up to Downloading |
| Filing | Every 10 minutes LazyLibrarian copies finished downloads to `media/audiobooks/Author/Title` (the torrent keeps seeding). Audiobookshelf picks the book up, and Discord gets a message. | Fake. **Not yet live.** |
| Remove | Cancels the Request, or deletes the torrent. Once the book is in Audiobookshelf, deletes that copy too, but only one added after the Request was made, so books you already had are never touched. | Unit (the matching rule), Fake, Live during a download. **Not yet live:** after it's in Audiobookshelf. |
| Existing library | The Audiobookshelf already in use moved into the stack with all its books, users, progress and stats. | Live |

### Admin

| Feature | What it does | Tested |
|---|---|---|
| Admin view | Problems (Missing, Failed Download, Failed Import) with one-click fixes: search again, or blocklist the release and try another. Also what's downloading, speeds, library counts, disk space and Requests by person. | Unit (the Problem rules), Fake, Live (the page). **Not yet live:** a real Problem and its fix. |
| Settings | Size limits (see Movies and TV). | Fake |

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
| Seeding | Every torrent seeds, not just a few at a time. | Live (the setting). **Not yet seen:** a finished torrent seeding. |
| Config backups | Every app's settings copied nightly and kept for a week (restore steps in the README). | Live (a backup ran and includes Audiobookshelf's database). **Never tried:** a restore. |
| Cloudflare Tunnel | Public addresses for Arrmy and the apps. | Live |
| Media files on your PC | Through the server's own Samba share, so the stack doesn't run one. | Not part of Arrmy |

## Next: release v1.1.0

Finish testing on the server, then publish v1.1.0.

Audiobooks:

1. An audiobook goes all the way into Audiobookshelf and shows Available.
2. Remove an audiobook that's already in Audiobookshelf.

Movies and TV:

3. A movie and a TV season import into Plex and show Available.
4. Edit seasons and Remove on a real show and movie.
5. Set size limits in Settings and check Radarr and Sonarr picked them up.

Everyone:

6. A Discord message arrives (set `DISCORD_WEBHOOK_URL` first).
7. A Requester signs in.

Tidy-up: `SMB_USER` and `SMB_PASSWORD` in the Portainer stack are unused since the stack's Samba was dropped, and can be deleted.

## Later

### Series and Author Requests

Both change the rule that a Request is the smallest useful unit (one book), so that gets settled before either is built.

- **Series Requests.** Request every audiobook in a series at once, from any book in it.
  - How: LazyLibrarian already knows series (`getWorkSeries`, `getSeriesMembers`). Arrmy would want each book in the series and show progress per book.
  - To decide: one Request per book, or one for the whole series? What Remove does to books already downloaded? Are books added to the series later requested too (LazyLibrarian can subscribe to a series)?
- **Author Requests.** Request every audiobook by an author, and optionally their new releases.
  - How: LazyLibrarian adds the author with their books (`addAuthorID`), then Arrmy wants each one. For new releases the author is set to Active. LazyLibrarian's "New AudioBook Status" setting applies to every Active author, so Arrmy may need to want new books itself instead.
  - To decide: a cap, because prolific authors list 100+ works on OpenLibrary, including translations and collections. How to skip collections and duplicates. Whether Requesters can do this, or only the Admin.

### Other planned

- **Audiobook Problems** in the Admin view (wanted but never found), like Missing for movies.
- **More Media Types.** Music (Lidarr → Plex); Books and Periodicals (LazyLibrarian → Kavita); Comics (Kapowarr → Kavita); Manga (Mangarr → Kavita).
- **Better Movies + TV.** Anime routed to anime-tuned Radarr and Sonarr, Recyclarr quality profiles, Bazarr subtitles.
- **YouTube channels** (TubeArchivist), once its Plex plugin is confirmed to work.

## Not planned

- Usenet (SABnzbd) and Unpackerr.
- Requester reports, and replacing each app's own settings pages.
- Book wishlists (NYT bestsellers, Goodreads shelves): LazyLibrarian can do these itself.
