# Contributing

Thanks for helping Sonora! Sonora is a self-hosted music PWA built with Node 24, SQLite and yt-dlp.

## Development setup

    git clone https://github.com/heidman06/sonora.git
    cd sonora
    cp .env.example .env
    mkdir -p data
    npm install --no-audit --no-fund
    npm run check
    npm test
    SONORA_DATA=./data PIPED_URL=http://127.0.0.1:8081 node server/index.mjs

Requirements: Node.js 24+, yt-dlp, ffmpeg. YouTube cookies are optional in development.

## Guidelines

- One coherent change per commit; clear commit message (vX.Y.Z: ...).
- API changes must update docs/API.md.
- Operations changes must update docs/PLAYBOOK.md in the private deployment repo.
- Never commit data/, cookies, SQLite files or secrets.
- Tests and npm run check must pass before a pull request.
- Prefer Node built-ins over npm dependencies (zero-dependency philosophy).
- Keep the public documentation in English.

## Reporting bugs

Open a GitHub issue with steps to reproduce, expected and actual behavior, Node and browser versions, and relevant logs. Do not include passwords, cookies or personal data.
