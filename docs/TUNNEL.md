# Public exposure via Tailscale Funnel

Sonora is exposed to the public internet on a **dedicated port**, using the Tailscale Funnel already authenticated on the host.

## Current production setup

    sudo tailscale funnel --bg --https=8443 http://127.0.0.1:3011

- **Public Sonora URL: `https://<node>.<tailnet>.ts.net:8443/musique/`**
- Only the Sonora hub (`127.0.0.1:3011`) is reachable on that port: `/musique/`, `/api/mus/*`, `/api/piped/*`, `/api/img/*`, `/musique/dl/*`, `/musique/hls/*`, `/subsonic/*`.
- **Port 443 is NOT used by Sonora**: nginx owns 443 on this host (the dashboard). A funnel on 443 is shadowed by nginx and exposes the dashboard instead — that mistake was made and corrected; Sonora uses **8443**.
- The tailnet `serve` entries (one per app, ports 8448–8479) are **separate** from the funnel and must stay in place.

## Verify (from outside the tailnet)

    tailscale funnel status
    curl -s "https://<node>.<tailnet>.ts.net:8443/api/mus/health?$(date +%s)"

## Revert (tailnet-only again)

    sudo tailscale funnel off          # only disables the public funnel
    # NEVER use `tailscale funnel reset` (see warning below)

## ⚠️ Warning: `tailscale funnel reset` wipes the whole `serve` config

On Tailscale 1.104, `tailscale funnel reset` resets **both** funnel and tailnet serve config: every `https://<node>:84xx` endpoint of every app disappears (Sonora included). That happened once during setup; the config was rebuilt from the dashboard service list.

**Backups (on the host)**:

    ~/dashboard/backups/serve-config.json     # tailscale serve status --json
    ~/dashboard/backups/funnel-config.json
    ~/dashboard/backups/serve-status.txt
    ~/dashboard/backups/restore-serve.sh      # replays every serve entry

**Restore**:

    bash ~/dashboard/backups/restore-serve.sh

Port map currently replayed (public → local): 443→3010, 8448→9090 (https+insecure), 8449→3010, 8450→61208, 8451→3011, 8452→8085, 8454→8092, 8455→43211, 8460→8088, 8461→3001, 8462→8222, 8464→8099, 8465→8091, 8466→5678, 8467→9095, 8468→3099, 8471→2586, 8473→9120, 8474→8483, 8476→5007, 8479→8080.


## Hardened public entry point (v2.5.0+)

The funnel targets the gateway (127.0.0.1:3012), never the hub directly:

    sudo tailscale funnel --bg --https=8443 http://127.0.0.1:3012

The gateway (server/public-gateway.mjs, systemd sonora-public.service) allowlists Sonora paths only, rate-limits per IP, and returns 404 for every other hub path (/libros, /mavie, dashboards...).

Consequences for this host:

- Dashboard moved to tailnet only: https://<node>.<tailnet>.ts.net:8449/ (the old public https://<node>/ on 443 has been removed from serve).
- Public Sonora: https://<node>.<tailnet>.ts.net:8443/musique/.
- Sign-up requires the invitation code (SONORA_SIGNUP_CODE set in the systemd drop-in of the hub).
## Notes and limits

- The hostname is the machine's Tailscale node name; Tailscale cannot give per-app subdomains on `ts.net`. For a pretty dedicated domain, use a Cloudflare named tunnel in front of the same hub (requires a domain on Cloudflare).
- Funnel is a relay: capacity is bounded by the host (CPU, yt-dlp semaphore <= 2, audio cache) and by the home **upload** bandwidth (~0.16 Mbps per concurrent listener).
- Free-plan Funnel bandwidth is fair-use; for heavy public traffic prefer a VPS with the same Docker image.
- The PWA origin differs from the tailnet `:8451` URL: browsers treat it as a new origin, so users sign in once again on the public URL.
