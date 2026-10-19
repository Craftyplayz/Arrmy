#!/usr/bin/env bash
# Prepares a fresh Linux box for the Arrmy Stack. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  for key in RADARR_API_KEY SONARR_API_KEY PROWLARR_API_KEY QBIT_PASSWORD SESSION_SECRET; do
    sed -i "s|^$key=.*|$key=$(openssl rand -hex 16)|" .env
  done
  echo "Created .env with fresh secrets. Fill in PUID/PGID/TZ, the VPN values and the Cloudflare token, then run: bash setup.sh."
  exit 0
fi
set -a; . ./.env; set +a
SUDO=$([ "$(id -u)" -eq 0 ] || echo sudo)

# TRaSH-guide layout: downloads and media share one /data tree, so imports are instant hardlinks, not copies.
$SUDO mkdir -p "$DATA_DIR"/torrents/{movies,tv} "$DATA_DIR"/media/{movies,tv}
$SUDO chown -R "$PUID:$PGID" "$DATA_DIR"
mkdir -p config/arrmy config/qbittorrent/qBittorrent
$SUDO chown -R "$PUID:$PGID" config/arrmy

conf=config/qbittorrent/qBittorrent/qBittorrent.conf
if [ ! -f "$conf" ]; then
  # qBittorrent only accepts a PBKDF2-SHA512 hash (16-byte salt, 100k rounds). Hashed inside the Arrmy image so the box needs nothing but Docker.
  docker compose build arrmy
  hash=$(docker compose run --rm --no-deps -T arrmy node -e "
    const c = require('node:crypto'), salt = c.randomBytes(16)
    const key = c.pbkdf2Sync(process.env.QBIT_PASSWORD, salt, 100000, 64, 'sha512')
    console.log(salt.toString('base64') + ':' + key.toString('base64'))")
  cat > "$conf" <<EOF
[LegalNotice]
Accepted=true

[BitTorrent]
Session\DefaultSavePath=/data/torrents
Session\DisableAutoTMMByDefault=false

[Preferences]
WebUI\Port=8080
WebUI\Username=admin
WebUI\Password_PBKDF2="@ByteArray($hash)"
EOF
fi

echo "Ready. Copy a claim token from https://plex.tv/claim into PLEX_CLAIM in .env, then run: docker compose up -d"
