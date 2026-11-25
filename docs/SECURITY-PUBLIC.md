# Security model and public exposure

## Threat model

Sonora is a self-hosted app: the server holds accounts, playlists, likes and history, and fetches media with yt-dlp/Piped. Anyone who can reach the HTTP surface can consume server resources (CPU, yt-dlp pool, disk cache, upload bandwidth). Protecting the public surface therefore matters even though the app is personal.

## What is public when the app is exposed

Only these paths are reachable through the public entry point (see TUNNEL.md):

    /musique/           static PWA shell (needed for the sign-in screen)
    /musique-legacy/    legacy client shell
    /api/mus/*          API: every data route requires a bearer session
    /api/piped/*        search proxy: requires a bearer session
    /api/img/*          artwork (public by nature)
    /subsonic/*         Subsonic gateway: standard Subsonic credentials required

Everything else (hub apps such as /libros or /mavie, dashboards, arbitrary paths) is NOT exposed: the public listener is a dedicated gateway (server/public-gateway.mjs) with an allowlist, not the multi-app hub.

## Hardening applied

| Control | Where |
|---|---|
| Public allowlist + 404 for anything else | server/public-gateway.mjs |
| Rate limits per IP (login 10/min, register 5/h, audio 240/min, images 1200/min, piped 120/min, subsonic 180/min, 429 + Retry-After) | server/public-gateway.mjs |
| Sign-up closed unless invitation code: SONORA_SIGNUP_CODE (or SONORA_SIGNUP=closed) | server/musique.mjs |
| Piped proxy requires a valid session | server/index.mjs (and the hub variant used in production) |
| Security headers: X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer, HSTS when HTTPS | hub |
| Audio streaming stays session-less (audio src cannot send headers) — mitigated by closed sign-up, obscure video ids and the audio rate limit | design note |
| Sessions: scrypt passwords, 30-day TTL, logout revocation, per-account SQL isolation | server/musique.mjs |

## Operational rules

- Never expose the multi-app hub directly; expose the gateway only.
- Keep SONORA_SIGNUP_CODE secret; rotate it if leaked (it only gates new accounts).
- tailscale funnel reset wipes the tailnet serve config: use tailscale funnel off to stop the public entry point, and restore with ~/dashboard/backups/restore-serve.sh.
- Backups of the serving config live in ~/dashboard/backups/.
