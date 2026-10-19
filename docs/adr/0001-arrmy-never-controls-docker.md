# Arrmy never controls Docker

Arrmy ships one `docker-compose.yml` with every Service, Supporting Service, Media Server and Arrmy itself, and on first boot it does the Wiring through each Service's API. We rejected letting Arrmy start and stop containers through the Docker socket, even though that would allow adding Services from the UI: Arrmy is reachable from the internet through Cloudflare Tunnel, and the socket is root on the host, so one login bug would become a full server takeover. Adding a Service means editing the compose file.
