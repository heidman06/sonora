# Changelog

## v1.12.0 — 2026-11-24
- Préparation publication : CHANGELOG, CONTRIBUTING, SECURITY, guide PUBLISH
- Release bundle/tar vérifiés (clone + tests + démarrage)
- Documentation API/playbook mises à jour

## v1.11.1
- Smoke test tolérant au cache recos froid ; /feedback relance le calcul

## v1.11.0
- Feedback recos : POST /feedback (dismiss/like), bouton ✕ sur « Pour toi »
- Exclusion des titres rejetés des recos/Mix/Daily Mix, invalidation cache

## v1.10.0
- Recos v3 : graines Piped relatedStreams + affinités artistes (cache v4)

## v1.9.0
- Subsonic : playlists mappées en albums/artistes (CarPlay), guide CARPLAY.md

## v1.8.0
- Couverture endpoints Amperfy, cache auth Subsonic (ping 1102 ms → 14 ms), test de charge

## v1.7.0
- Passerelle Subsonic (/subsonic/rest) pour Amperfy/CarPlay, auth legacy + token

## v1.6.0
- Daily Mixes (Découvertes / En boucle / Tes favoris), captures README

## v1.5.0
- Validation API : clamp n, titres ≤ 300 car., audit 23 cas

## v1.4.0
- Sessions TTL 30 j + révocation logout, anti-répétition Mix

## v1.3.0
- Dockerfile + docker-compose, CI GitHub Actions, 11 tests node:test

## v1.2.0
- Serveur autonome (server/index.mjs), audio extrait, config env, proxy Piped

## v1.1.0
- Recos v2, cache SQLite, Mix radio, /health, smoke test + timer

## v1.0.0
- PWA Sonora, comptes multi-utilisateurs, playlists, favoris, historique, import Spotify
