# Arrmy

One website where family and friends request movies and TV, and the Admin runs the *arr Stack. This is Milestone 1: Movies + TV.

Vocabulary is in [GLOSSARY.md](GLOSSARY.md). The reasons behind the design are in [docs/adr/](docs/adr/).

## Set up the Stack

Needs a fresh Linux box with Docker and the Compose plugin.

1. Copy this folder to the box and `cd` into it.
2. Run `bash setup.sh`. It creates `.env` with fresh secrets.
3. Fill in `.env`: `PUID`/`PGID` (run `id`), `TZ`, `DATA_DIR`, the VPN values, `CLOUDFLARE_TUNNEL_TOKEN`, and optionally `DISCORD_WEBHOOK_URL`.
4. Run `bash setup.sh` again. It creates the `/data` folders and qBittorrent's login, and builds Arrmy.
5. Copy a claim token from <https://plex.tv/claim> into `PLEX_CLAIM`. Within 4 minutes, run `docker compose up -d`.
6. In Cloudflare Zero Trust, give the tunnel a public hostname (e.g. `arrmy.yourdomain.com`) that points to `http://arrmy:3000`.
7. Open Arrmy and **Sign in with Plex**. As the Plex server owner you become the Admin, and Arrmy adds the Movies and TV Shows libraries to Plex.
8. Add indexers in Prowlarr (`http://<box>:9696`). This is the only step Arrmy can't do for you. Prowlarr copies the indexers into Radarr and Sonarr.
9. Share your Plex libraries with family. Anyone you share with can sign in to Arrmy as a Requester.

On first boot, Arrmy wires everything else: root folders, qBittorrent, Prowlarr sync and the import webhooks. Follow it with `docker compose logs -f arrmy`. When it's done, the log says `[wire] Stack wired`.

## On the home network

| App | Address | Login |
|---|---|---|
| Arrmy | `http://<box>:3000` | Plex |
| Plex | `http://<box>:32400/web` | Plex |
| qBittorrent | `http://<box>:8080` | `admin` / `QBIT_PASSWORD` from `.env` |
| Prowlarr, Radarr, Sonarr | `:9696`, `:7878`, `:8989` | create one on first visit |

Plex runs on Docker's bridge network. Set **Plex → Settings → Network → LAN Networks** to your home subnet (e.g. `192.168.1.0/24`); otherwise Plex treats devices at home as remote.

## Develop

```sh
npm install
npm test        # unit tests for sessions and Request status
npm run build
```

`npm run dev` needs `SESSION_SECRET`, `DB_PATH`, and `RADARR_URL`/`SONARR_URL` pointing at Services it can reach.
