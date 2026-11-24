# Checklist open source

État au 2026-11-24 (v1.3).

## Fait
- [x] Licence MIT + README + docs API/playbook
- [x] Frontend PWA autonome (web/)
- [x] Backend musique (server/musique.mjs) + scripts import/résolution
- [x] Moteur de recos v2 + Mix + endpoint /health
- [x] Smoke test 13 vérifications + timer systemd
- [x] Aucun secret dans le dépôt (data/ ignoré)
- [x] Route audio extraite dans `server/audio.mjs` (cache .ok, Range 206, coalescing, streaming progressif)
- [x] Serveur autonome `server/index.mjs` (API + audio + PWA + proxy Piped optionnel)
- [x] Configuration par variables d'environnement (`SONORA_*`, `YTDLP_PATH`, `PIPED_URL`)
- [x] Smoke test exécutable contre un serveur externe (`SONORA_BASE`, `SONORA_DATA`)

## Passerelle CarPlay
- [x] Gateway Subsonic (playlists, favoris, recherche, stream, pochettes)
- [x] Auth legacy + token MD5 optionnelle
- [ ] Validation sur autoradio CarPlay réel (Amperfy)
- [x] Endpoints Amperfy couverts (ping, playlists, albums, artistes, recherche, stream, covers, genres, extensions)
- [x] Guide de test CarPlay (docs/CARPLAY.md)
- [x] Test de charge (0 erreur, p95 < 35 ms sur API)

## À faire avant v1 publique
- [x] ~~Extraire la route audio~~ `/musique/dl` de `dashboard/server.mjs` vers `server/audio.mjs` autonome (cache .ok, Range, coalescing, limites)
- [x] Proxy Piped basique (`PIPED_URL`) + cache 5 min dans `server/index.mjs`
- [x] Config par variables d'environnement : `SONORA_DATA`, `SONORA_COOKIES`, `YTDLP_PATH`, `PIPED_URL`, `SONORA_PORT`, `SONORA_HOST`
- [x] Dockerfile + docker-compose d'exemple (build et run validés)
- [x] Chemins absolus remplacés (défauts relatifs au module + env)
- [x] Tests automatisés : 17 tests `node:test` (recos/filtres + API) exécutables hors mini PC
- [x] CI GitHub Actions (syntaxe, tests, démarrage serveur + health)
- [x] README avec captures (docs/screenshots) et guide Docker/tests
- [ ] Premier run CI sur GitHub + publication du dépôt
- [ ] Vérifier licences tierces (icônes, polices système) + NOTICE

