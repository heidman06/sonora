# Security

## Reporting a vulnerability

Please use GitHub private vulnerability reporting (Security tab) or contact the maintainer directly. Do not open a public issue for an unpatched vulnerability.

## Threat model

- Sonora is designed for self-hosted use behind a VPN, tailnet or authenticated reverse proxy.
- Never expose /subsonic/rest or /api/mus to the Internet without HTTPS and access control.
- Passwords are stored with scrypt (random salt). Sessions have a 30-day TTL and are revoked on logout.
- YouTube cookies (data/yt-cookies.txt) grant access to the linked Google account: chmod 600, never commit.
- The Subsonic gateway accepts legacy password authentication (password in URL query): keep it on a trusted network/VPN. Optional MD5 token authentication is available via SONORA_SONIC_USERS.
- No telemetry. No external calls apart from configured YouTube/Piped endpoints.

## Operational practices

- Change default passwords before exposing the app.
- Back up data/ (SQLite WAL + cookies + audio cache).
- Keep yt-dlp up to date; cookies expire periodically.
