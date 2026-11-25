# Public exposure via Tailscale Funnel

Sonora can be exposed to the public internet **without opening any port and without a new account**, using the Tailscale Funnel already authenticated on the host.

## Current production setup

    sudo tailscale funnel --bg 3011

- Public URL: `https://<node>.<tailnet>.ts.net/` (port 443, HTTPS certificate issued by Tailscale).
- Funnel proxies to the local hub `http://127.0.0.1:3011`; the tailnet-only `tailscale serve` entries (other apps) are untouched.
- The funnel config is stored by `tailscaled`, so it **survives reboots** and service restarts.
- Auth is unchanged: every `/api/mus/*` and `/subsonic/*` call still requires a bearer session; only the static PWA shell is public.

## Verify

    tailscale funnel status          # shows "Funnel on" + public hostname
    curl -s https://<node>.<tailnet>.ts.net/api/mus/health

## Revert (tailnet-only again)

    sudo tailscale funnel off

## Notes and limits

- Funnel is a relay: capacity is bounded by the host (CPU, yt-dlp semaphore <= 2, audio cache) and by the home **upload** bandwidth (~0.16 Mbps per concurrent listener), not by the tunnel itself.
- Free-plan Funnel bandwidth is fair-use; for heavy public traffic prefer a VPS with the same Docker image.
- The PWA origin changes from `:8451` to `:443`: browsers treat it as a new origin, so users sign in once again on the public URL (localStorage/SW are per-origin).
- Do not run `tailscale funnel --bg <port>` with a port that is itself a `tailscale serve` TLS listener (double proxy); point it at the plaintext hub port (3011).
