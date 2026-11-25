# Public exposure via Tailscale Funnel

Sonora is exposed to the public internet on a **dedicated port**, without opening any box port and without a new account, using the Tailscale Funnel already authenticated on the host.

## Current production setup

    sudo tailscale funnel --bg --https=8443 http://127.0.0.1:3011

- **Public Sonora URL: `https://<node>.<tailnet>.ts.net:8443/musique/`** (HTTPS certificate issued by Tailscale).
- Only the Sonora hub (`127.0.0.1:3011`) is reachable on that port: `/musique/`, `/api/mus/*`, `/api/piped/*`, `/api/img/*`, `/musique/dl/*`, `/musique/hls/*`, `/subsonic/*`. Root `/` redirects to `/musique/`.
- **Port 443 is NOT used by Sonora**: nginx already owns 443 on this host (the « centro de control » dashboard). A funnel on 443 would be shadowed by nginx and would expose the dashboard instead — that mistake was made and corrected; Sonora therefore uses **8443** (Funnel also allows 10000).
- The funnel config is stored by `tailscaled` and **survives reboots**.
- Auth unchanged: every `/api/mus/*` and `/subsonic/*` call requires a bearer session; only the static PWA shell is public.

## Verify (from outside the tailnet)

    tailscale funnel status                      # "Funnel on" + https://<node>:8443
    curl -s https://<node>.<tailnet>.ts.net:8443/api/mus/health

## Revert (tailnet-only again)

    sudo tailscale funnel reset

## Notes and limits

- The hostname is the machine's Tailscale node name; Tailscale cannot give per-app subdomains on `ts.net`. For a pretty dedicated domain (`sonora.example.fr`), use a Cloudflare named tunnel in front of the same hub (requires a domain on Cloudflare).
- Funnel is a relay: capacity is bounded by the host (CPU, yt-dlp semaphore <= 2, audio cache) and by the home **upload** bandwidth (~0.16 Mbps per concurrent listener), not by the tunnel.
- Free-plan Funnel bandwidth is fair-use; for heavy public traffic prefer a VPS with the same Docker image.
- The PWA origin differs from the tailnet `:8451` URL: browsers treat it as a new origin, so users sign in once again on the public URL (localStorage/SW are per-origin).
- Never point a funnel at a port that is itself a TLS listener (double proxy), and never at 443 on this host (nginx owns it).
