# Roadmap

## Done

- **Milestone 1: Movies + TV.** Sign in with Plex, Requests to Radarr/Sonarr, live status, a Discord message when a Request is Available, first-boot Wiring.
- **Deploy from GitHub with Portainer.** Image built by GitHub Actions, one-shot `init` container, configurable ports.
- **VPN.** PIA with port forwarding for qBittorrent; Prowlarr and FlareSolverr reach indexers through it.
- **Live download progress.** Read straight from qBittorrent, refreshed every 5 seconds.
- **Seeding.** Every finished torrent seeds, not just a few at a time.
- **Edit and remove Requests.** Add or remove seasons of a show. Removing a Request cancels it if nothing has downloaded yet, otherwise deletes the download and the files, keeping whatever another Request still wants.
- **Media files on your PC.** Through the server's existing Samba share (port 445 is already in use there, so the stack doesn't run its own).
- **Config backups.** Every app's settings are copied nightly and kept for a week (restore steps in the README).
- **Size limits.** The Admin sets a maximum per movie, per hour of episode and per show (Settings). Bigger releases are never grabbed; a TV Request that could go over the show limit is refused with the estimate.
- **Admin view.** One page with Problems (Missing, Failed Download, Failed Import) and one-click fixes, what's downloading, library and disk stats, and Requests by person.
- **English-only audio.** At the same quality, Radarr and Sonarr pick a release with only English audio over MULTi, Dual Audio or another language, so files are smaller. Untagged releases count as the original language, so foreign films and anime are left alone. In Plex, each person still sets their own preferred audio language.
- **Audiobooks.** An Audiobooks tab: LazyLibrarian finds and downloads the book and files it where Audiobookshelf watches; status, Discord and Remove work as for movies. With an Audiobookshelf API key, books you already own show as Available and Remove deletes the downloaded copy.

## Next

Pick from Later.

## Later

- **More Media Types.** Music (Lidarr); Books and Periodicals (LazyLibrarian is already here; reading in Kavita); Comics (Kapowarr); Manga (Mangarr).
- **Audiobook Problems** in the Admin view (wanted but never found), like Missing for movies.
- **Better Movies + TV.** Anime routing to anime-tuned Radarr/Sonarr, Recyclarr quality profiles, Bazarr subtitles.
- **YouTube channels** (TubeArchivist), once its Plex plugin is confirmed to work.
