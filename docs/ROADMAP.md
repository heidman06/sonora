# Roadmap

## v1.1 — moteur (fait 2026-11-24)
- Recos v2 pondérées + cache SQLite stale-while-revalidate
- Mix radio + bouton ✨ Mix
- /health + smoke test + timer 15 min

## v1.3 — packaging (fait 2026-11-24)
- Serveur autonome + extraction audio
- Config par variables d'environnement
- Dockerfile + docker-compose (build/run validés)
- 11 tests node:test + GitHub Actions

## v1.6 — personnalisation (fait 2026-11-24)
- Daily Mixes (Découvertes / En boucle / Tes favoris)
- Audit XSS (aucune faille), audit API 23 cas
- Sessions TTL + logout révoqué

## v1.0 open source
- Publication GitHub + captures
- Premier run CI public

## v1.7 — CarPlay (fait 2026-11-24)
- Passerelle Subsonic (`/subsonic/rest`) pour Amperfy
- Playlists, favoris, recherche, stream, pochettes
- Auth legacy + token optionnelle
- Validation écran CarPlay réel à faire

## Backlog
- Tests de charge (recos/mix, 100 utilisateurs)
- Mode hors ligne renforcé (téléchargements)
- Recherche interne (index local)
