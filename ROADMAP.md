# Roadmap

## Done

- **Milestone 1: Movies + TV.** Sign in with Plex, Requests to Radarr/Sonarr, live status, a Discord message when a Request is Available, first-boot Wiring.
- **Deploy from GitHub with Portainer.** Image built by GitHub Actions, one-shot `init` container, configurable ports.
- **VPN.** PIA with port forwarding for qBittorrent; Prowlarr and FlareSolverr reach indexers through it.
- **Live download progress.** Read straight from qBittorrent, refreshed every 5 seconds.
- **Seeding.** Every finished torrent seeds, not just a few at a time.
- **Edit and remove Requests.** Add or remove seasons of a show. Removing a Request cancels it if nothing has downloaded yet, otherwise deletes the download and the files, keeping whatever another Request still wants.
- **Media files on your PC.** A read-only network share of the media folder.

## Next

1. **Size limits.** A maximum size per movie, per episode and per show, set by the Admin. A TV Request whose estimate goes over the show limit is refused with the estimate.
2. **Admin view.** Problems (Missing, Failed Download, Failed Import) with one-click fixes; stats (library counts, disk space, live queue, Requests by person).

## Later

- **More Media Types.** Music (Lidarr); Books, Audiobooks and Periodicals (LazyLibrarian, Kavita, Audiobookshelf); Comics (Kapowarr); Manga (Mangarr).
- **Better Movies + TV.** Anime routing to anime-tuned Radarr/Sonarr, Recyclarr quality profiles, Bazarr subtitles.
- **YouTube channels** (TubeArchivist), once its Plex plugin is confirmed to work.
