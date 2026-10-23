# Arrmy

One website where family and friends request movies, TV and audiobooks, and the Admin runs the *arr Stack.

Vocabulary is in [GLOSSARY.md](GLOSSARY.md). The reasons behind the design are in [docs/adr/](docs/adr/).

## Deploy with Portainer

Needs a Linux box running Docker and Portainer. GitHub builds the Arrmy image on every push to `main` (`ghcr.io/craftyplayz/arrmy`), so the box never builds anything.

1. Fill in a copy of [.env.example](.env.example). Generate the five secrets with the one-liner at the top of the file, then set `PUID`/`PGID` (run `id` on the box), `TZ`, the VPN values, `CLOUDFLARE_TUNNEL_TOKEN`, and optionally `DISCORD_WEBHOOK_URL` and `DISCORD_ADMIN_ID`.
2. In Portainer: **Stacks → Add stack**, name it `arrmy`, choose **Repository**.
   - Repository URL: `https://github.com/Craftyplayz/Arrmy`
   - Repository reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
3. Under **Environment variables**, click **Load variables from .env file** and pick your file.
4. Copy a claim token from <https://plex.tv/claim> into `PLEX_CLAIM`. Within 4 minutes, click **Deploy the stack**.
5. In Cloudflare Zero Trust, give the tunnel a public hostname (e.g. `arrmy.yourdomain.com`) that points to `http://arrmy:3000`.
6. Open Arrmy and **Sign in with Plex**. As the Plex server owner you become the Admin, and Arrmy adds the Movies and TV Shows libraries to Plex.
7. Add indexers in Prowlarr (`http://<box>:7656`). This is the only step Arrmy can't do for you. Prowlarr copies the indexers into Radarr and Sonarr. To add every public English one that works in one go, run `node --env-file=.env scripts/add-indexers.mjs http://<box>:7656` from a copy of this repo with your `.env`.
8. Share your Plex libraries with family. Anyone you share with can sign in to Arrmy as a Requester.
9. Optional: in Audiobookshelf, **Settings → API Keys → Add API Key**, and put it in `ABS_API_KEY`. Then audiobooks you already own show as Available, and removing an audiobook Request deletes the copy Arrmy downloaded.

On first start, the `init` container creates the `/data` folders and qBittorrent's login, then exits. After that, Arrmy wires everything else: root folders, qBittorrent, Prowlarr sync, the import webhooks and a preference for English-only audio. Follow it in Portainer under **Containers → arrmy → Logs**. When it's done, the log says `[wire] Stack wired`.

**Updating:** open the stack and click **Pull and redeploy**, with **Re-pull image** turned on.

**Releases:** `refs/heads/main` always runs the newest build. To run a fixed, tested version instead, set the stack's **Repository reference** to a release tag, e.g. `refs/tags/v1.0.0`. A release's stack file names its own Arrmy image (`arrmy:1.0.0`), so nothing else needs changing. Releases are listed at <https://github.com/Craftyplayz/Arrmy/releases>.

**Releasing from your PC:** with `PORTAINER_URL` (e.g. `http://192.168.16.3:9000`) and `PORTAINER_TOKEN` (Portainer → My account → Access tokens) in `.env`, `bash scripts/release.sh` releases what is on `main` as the next release candidate and redeploys the stack. Give it a version (`bash scripts/release.sh 1.1.0`) to choose one, or to resume a release that was interrupted. The page footer shows which version is running.

**Backups:** the `backup` container saves every app's settings to `BACKUP_DIR` when it starts and nightly at 04:00 (UTC), keeping `BACKUP_KEEP_DAYS` days. To restore:

1. Stop the stack in Portainer.
2. Over SSH, list the backups and pick one: `ls -lh <BACKUP_DIR>`
3. Unpack it over the settings folder: `sudo tar -xzf <BACKUP_DIR>/arrmy-<date>.tar.gz -C <CONFIG_DIR>`
4. Start the stack.

**Without Portainer:** clone the repo on the box, save your filled-in file as `.env` next to `docker-compose.yml`, and run `docker compose up -d`. Update with `git pull && docker compose pull && docker compose up -d`.

## On the home network

| App | Default address | Login |
|---|---|---|
| Arrmy | `http://<box>:7654` | Plex |
| Plex | `http://<box>:32400/web` | Plex |
| qBittorrent | `http://<box>:7655` | `admin` / `QBIT_PASSWORD` from `.env` |
| Prowlarr, Radarr, Sonarr | `:7656`, `:7657`, `:7658` | create one on first visit |
| LazyLibrarian | `http://<box>:7659` | `admin` / `QBIT_PASSWORD` from `.env` |
| Audiobookshelf | `http://<box>:13378` | your Audiobookshelf account |
| Tautulli | `http://<box>:7660` | on the first visit, sign in with Plex once; Arrmy already has its API key |
| autobrr | `http://<box>:7661` | `admin` / `QBIT_PASSWORD` from `.env`, made by Arrmy on first start |
| Tdarr | `http://<box>:7662` | none |
If a port is already taken on your box, change it with the `*_PORT` settings in [.env.example](.env.example).

**Kometa** has no page: it runs every night at 06:00 (the stack's `TZ`) and makes Plex collections (franchises like Marvel and Star Wars, and "Requested by <name>" from Arrmy's Requests) and poster overlays (resolution with HDR and Dolby Vision, audio codec, a show's airing status, and New, More coming and Leaving soon from Arrmy). It never downloads anything: titles missing from a collection go into its report, `CONFIG_DIR/kometa/Movies_report.yml` and `TV Shows_report.yml`. Arrmy writes its config into `CONFIG_DIR/kometa` once the Admin has signed in and `TMDB_API_KEY` (the v3 key) is set; its log is in `CONFIG_DIR/kometa/logs`. To run it now: `docker exec <kometa container> /.venv/bin/python3 kometa.py --run`.

**Media on your PC:** share `DATA_DIR/media` with the box's own Samba (the stack doesn't run one, since port 445 can only be used once).

Plex runs on Docker's bridge network. Set **Plex → Settings → Network → LAN Networks** to your home subnet (e.g. `192.168.1.0/24`); otherwise Plex treats devices at home as remote.

### autobrr and Tdarr

**autobrr** grabs a release seconds after a private tracker announces it on IRC. Arrmy adds Radarr, Sonarr and qBittorrent (through the VPN) as its clients, so what is left is yours: **Settings → IRC** (your tracker's network and your key), **Settings → Indexers** (the tracker), then **Filters** with the action **Radarr**, **Sonarr** or **qBittorrent**. If you made an autobrr account before Arrmy did, Arrmy leaves it alone: add the three clients under **Settings → Download Clients** (Radarr and Sonarr need their URL `http://radarr:7878` / `http://sonarr:8989` and API key, qBittorrent `http://gluetun:8080` with `admin` / `QBIT_PASSWORD`).

**Tdarr** shrinks files to H.265 on the CPU, in place, and sees only `media/` (never `torrents/`, whose files are hard-linked for seeding). Its schedule and plugins are stored in its own database, so set them once in its page:

1. **Libraries → Library +**: name `Movies`, source `/data/media/movies`; again for `TV` with `/data/media/tv`. Turn on **Scan on start** and **Folder watch**.
2. In each library, **Transcode options**: add the plugin **Migz Transcode Using CPU & FFMPEG** (`Tdarr_Plugin_MC93_Migz1FFMPEG_CPU`) with **container** `original` (an `.mp4` stays `.mp4`, so Radarr and Sonarr never see their file vanish and search again), then **New file size check** (`Tdarr_Plugin_a9he_New_file_size_check`) after it, so a result bigger than the original is dropped.
3. In each library, **Schedule**: tick only the hours 01:00 to 07:00 on every day (the stack's `TZ`).
4. **Nodes**: leave the internal node at 1 transcode CPU worker and 1 health-check CPU worker, with 0 for the GPU workers. Raise the transcode workers only if Plex never stutters at night.

The bot makes an **Arrmy** category in your server with two channels and four forums: #downloading (a live card per download, updated every 5 seconds), #weekly-summary (who watched what in Plex, every Sunday evening), **Requests** (a thread per title: who asked, the search, the release picked, the download, Available with a link to it), **Activity** (a thread per movie, show or book: who played it, on what, for how long), and, for the Admin only, **Problems** (a thread per Problem, with each step The Doctarr takes) and **Admin** (a thread per app or subject: down and back, settings, access, sign-ins, updates). Only the bot opens threads; people can reply in them. Every message is a card with the poster, cover or app icon, in [DESIGN.md](DESIGN.md)'s colours; the progress bar's pieces are uploaded once as the bot's own emoji, and Arrmy's logo as its avatar. It reports, @mentions you for Problems, app updates, an app or the VPN going down, low disk space and failed backups, and lets you reply to The Doctarr in a Problem's thread (The Doctarr, below). It has no live connection to Discord, so nothing extra runs: Arrmy calls Discord's API (reading the Problem threads waiting on you every 20 seconds), and Discord sends slash commands and button clicks to Arrmy.

1. [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**, name it Arrmy.
2. **General Information**: copy the **Public Key** (`DISCORD_PUBLIC_KEY`). Set **Interactions Endpoint URL** to `https://arrmy.<your domain>/api/discord` (after step 5, since Discord checks it).
3. **Bot** → **Reset Token**: copy it (`DISCORD_BOT_TOKEN`). On the same page, under **Privileged Gateway Intents**, turn on **Message Content Intent**, so the bot can read your replies to The Doctarr (Discord hides what people write from bots without it).
4. **OAuth2 → URL Generator**: scopes `bot` and `applications.commands`; bot permissions **Manage Channels**, **Manage Threads**, **View Channels**, **Send Messages**, **Send Messages in Threads**, **Embed Links**, **Attach Files**, **Read Message History**. Open the URL and add the bot to your server (a bot added before the forums needs these added to its role).
5. In the stack: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_GUILD_ID` (right-click the server → Copy Server ID, with Developer Mode on), `DISCORD_ADMIN_ID` (right-click yourself → Copy User ID), `PUBLIC_DOMAIN` (e.g. `example.com`), and optionally `PORTAINER_STACK_URL`. Redeploy.
6. Sign in to Arrmy once as the Admin, so the bot can see Plex sessions and who Plex is shared with.

Slash commands (`/status`, `/queue`, `/requests`, `/problems`, `/search`) start Admin-only; **Server Settings → Integrations → Arrmy** opens them to others. If Cloudflare challenges Discord's requests, add a rule that skips the challenge for `/api/discord`.

### The Doctarr

Claude looks into each Problem the bot opens a thread for, on your Claude subscription, and posts each check and fix in that thread as it goes, then the cause and whether it solved it. If it didn't, the thread is tagged **Needs you** and you're @mentioned. It reads Radarr's, Sonarr's, Prowlarr's and qBittorrent's APIs, and can only run a few safe fixes (search again, try another release, test indexers, send a Cloudflare-blocked indexer through FlareSolverr, move a failing indexer to another of its web addresses, restart an app, recheck, start or reannounce a torrent, search again for an audiobook Edition). Anything else it tells you to do.

Its first look also posts every release found for the title, numbered, with the whole list attached as a text file. When nothing in the quality you want can be downloaded, Arrmy grabs the most seeded release turned down only for its quality (a 720p one when every 1080p one is dead, say; for a show only a whole season) and says so in the thread. When it couldn't solve a Problem, just reply in the thread in plain words: "download number 36", "why did the first two die?", "check again tomorrow", "remove this Request". It carries on from where it stopped (the same Claude conversation), answers in the thread, and you can keep replying. Only your replies count (`DISCORD_ADMIN_ID`), and anything it can't undo (removing a Request, deleting a torrent) waits for you to click **Go ahead**. It answers at most `DOCTOR_REPLIES` (30) replies a day, apart from `DOCTOR_DAILY`. For a book LazyLibrarian was looking for, Arrmy downloads your pick and files it into Audiobookshelf itself, and LazyLibrarian stops looking.

When AudioBook Bay refuses the VPN's region, it reconnects the VPN to other regions until AudioBook Bay answers (up to 4 tries), preferring ones that worked before, and remembers them in the `doctor` folder's `vpn-regions.json`. The region holds until gluetun restarts.

1. On any PC with Claude Code: `claude setup-token`, sign in, copy the token (it lasts a year).
2. In the stack: `CLAUDE_CODE_OAUTH_TOKEN` = the token. Redeploy.

It looks into each Problem once a day, and at most `DOCTOR_DAILY` (10) Problems a day, so your own use of Claude keeps its limits. Its log is the `doctor` container's.

## Develop

```sh
npm install
npm test        # unit tests for sessions and Request status
npm run build
```

`npm run dev` needs `SESSION_SECRET`, `DB_PATH`, and `RADARR_URL`/`SONARR_URL` pointing at Services it can reach.
