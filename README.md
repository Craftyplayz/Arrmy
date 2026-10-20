# Arrmy

One website where family and friends request movies and TV, and the Admin runs the *arr Stack. This is Milestone 1: Movies + TV.

Vocabulary is in [GLOSSARY.md](GLOSSARY.md). The reasons behind the design are in [docs/adr/](docs/adr/).

## Deploy with Portainer

Needs a Linux box running Docker and Portainer. GitHub builds the Arrmy image on every push to `main` (`ghcr.io/craftyplayz/arrmy`), so the box never builds anything.

1. Fill in a copy of [.env.example](.env.example). Generate the five secrets with the one-liner at the top of the file, then set `PUID`/`PGID` (run `id` on the box), `TZ`, the VPN values, `CLOUDFLARE_TUNNEL_TOKEN`, and optionally `DISCORD_WEBHOOK_URL`.
2. In Portainer: **Stacks → Add stack**, name it `arrmy`, choose **Repository**.
   - Repository URL: `https://github.com/Craftyplayz/Arrmy`
   - Repository reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
3. Under **Environment variables**, click **Load variables from .env file** and pick your file.
4. Copy a claim token from <https://plex.tv/claim> into `PLEX_CLAIM`. Within 4 minutes, click **Deploy the stack**.
5. In Cloudflare Zero Trust, give the tunnel a public hostname (e.g. `arrmy.yourdomain.com`) that points to `http://arrmy:3000`.
6. Open Arrmy and **Sign in with Plex**. As the Plex server owner you become the Admin, and Arrmy adds the Movies and TV Shows libraries to Plex.
7. Add indexers in Prowlarr (`http://<box>:7656`). This is the only step Arrmy can't do for you. Prowlarr copies the indexers into Radarr and Sonarr.
8. Share your Plex libraries with family. Anyone you share with can sign in to Arrmy as a Requester.

On first start, the `init` container creates the `/data` folders and qBittorrent's login, then exits. After that, Arrmy wires everything else: root folders, qBittorrent, Prowlarr sync and the import webhooks. Follow it in Portainer under **Containers → arrmy → Logs**. When it's done, the log says `[wire] Stack wired`.

**Updating:** open the stack and click **Pull and redeploy**, with **Re-pull image** turned on.

**Without Portainer:** clone the repo on the box, save your filled-in file as `.env` next to `docker-compose.yml`, and run `docker compose up -d`. Update with `git pull && docker compose pull && docker compose up -d`.

## On the home network

| App | Default address | Login |
|---|---|---|
| Arrmy | `http://<box>:7654` | Plex |
| Plex | `http://<box>:32400/web` | Plex |
| qBittorrent | `http://<box>:7655` | `admin` / `QBIT_PASSWORD` from `.env` |
| Prowlarr, Radarr, Sonarr | `:7656`, `:7657`, `:7658` | create one on first visit |

If a port is already taken on your box, change it with the `*_PORT` settings in [.env.example](.env.example).

**Media on your PC:** share `DATA_DIR/media` with the box's own Samba (the stack doesn't run one, since port 445 can only be used once).

Plex runs on Docker's bridge network. Set **Plex → Settings → Network → LAN Networks** to your home subnet (e.g. `192.168.1.0/24`); otherwise Plex treats devices at home as remote.

## Develop

```sh
npm install
npm test        # unit tests for sessions and Request status
npm run build
```

`npm run dev` needs `SESSION_SECRET`, `DB_PATH`, and `RADARR_URL`/`SONARR_URL` pointing at Services it can reach.
