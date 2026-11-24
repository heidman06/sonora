# Contribuer

Merci ! Sonora est une PWA musique auto-hébergée (Node 24, SQLite, yt-dlp).

## Développement

    git clone <repo> && cd sonora
    cp .env.example .env
    mkdir -p data
    npm run check
    npm test
    SONORA_DATA=./data PIPED_URL=http://127.0.0.1:8081 node server/index.mjs

- Node >= 24 (node:sqlite, node:test)
- Pas de framework frontend : PWA vanilla dans web/
- Tests : npm test (recos, API, Subsonic) ; charge : npm run load

## Règles

- Un commit = un changement cohérent, message clair (vX.Y.Z: ...)
- Toute évolution d API met à jour docs/API.md
- Toute intervention ops met à jour docs/PLAYBOOK.md
- Ne jamais committer : data/, cookies, bases SQLite, secrets
- Tests et npm run check doivent passer avant PR
- Pas de dépendances npm si Node natif suffit (philosophie zéro-dépendance)
