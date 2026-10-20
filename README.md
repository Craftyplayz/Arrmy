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

If a port is already taken on your box, change it with the `*_PORT` settings in [.env.example](.env.example).

**Media on your PC:** share `DATA_DIR/media` with the box's own Samba (the stack doesn't run one, since port 445 can only be used once).

Plex runs on Docker's bridge network. Set **Plex → Settings → Network → LAN Networks** to your home subnet (e.g. `192.168.1.0/24`); otherwise Plex treats devices at home as remote.

## Discord

The bot makes an **Arrmy** category in your server with eight channels: #requests, #downloads (a live card per download, updated every 5 seconds), #downloaded (each finished download), #problems, #admin-log, #system, #updates and #activity. Every message is a card with the poster, cover or app icon, in [DESIGN.md](DESIGN.md)'s colours; the progress bar's pieces are uploaded once as the bot's own emoji. It only reads and reports, and @mentions you for Problems, app updates, an app or the VPN going down, low disk space and failed backups. It has no live connection to Discord, so nothing extra runs: Arrmy calls Discord's API, and Discord sends slash commands to Arrmy.

1. [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**, name it Arrmy.
2. **General Information**: copy the **Public Key** (`DISCORD_PUBLIC_KEY`). Set **Interactions Endpoint URL** to `https://arrmy.<your domain>/api/discord` (after step 5, since Discord checks it).
3. **Bot** → **Reset Token**: copy it (`DISCORD_BOT_TOKEN`).
4. **OAuth2 → URL Generator**: scopes `bot` and `applications.commands`; bot permissions **Manage Channels**, **View Channels**, **Send Messages**, **Embed Links**. Open the URL and add the bot to your server.
5. In the stack: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_GUILD_ID` (right-click the server → Copy Server ID, with Developer Mode on), `DISCORD_ADMIN_ID` (right-click yourself → Copy User ID), `PUBLIC_DOMAIN` (e.g. `example.com`), and optionally `PORTAINER_STACK_URL`. Redeploy.
6. Sign in to Arrmy once as the Admin, so the bot can see Plex sessions and who Plex is shared with.

Slash commands (`/status`, `/queue`, `/requests`, `/problems`, `/search`) start Admin-only; **Server Settings → Integrations → Arrmy** opens them to others. If Cloudflare challenges Discord's requests, add a rule that skips the challenge for `/api/discord`.

## Develop

```sh
npm install
npm test        # unit tests for sessions and Request status
npm run build
```

`npm run dev` needs `SESSION_SECRET`, `DB_PATH`, and `RADARR_URL`/`SONARR_URL` pointing at Services it can reach.
