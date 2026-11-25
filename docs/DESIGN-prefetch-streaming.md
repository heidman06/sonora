# Design — Démarrage rapide des morceaux Sonora (HLS iOS)

**Objectif** : supprimer le téléchargement à froid (~4,5–5,3 s) au changement de titre, sans régression seek/Range/file iOS.

## Constats vérifiés (copie conforme aux lignes citées : _repos/sonora)
- frontend/src/audio/engine.ts:878-885 : prefetchNext = HEAD /musique/dl/ → ne réchauffe que le m4a, jamais le TS que lit iOS ; appelé en startHls:487 après playMedia (bloqué ~5 s sur segment froid) et sur l'événement play (:808), mais pas à la transition de titre HLS (:788-795) → titres >= 3 toujours froids.
- server/audio.mjs:85-86 : --concurrent-fragments 4 existe déjà ; inopérant sur le format 140 (fichier unique, pas de fragments).
- Le chemin progressif server/audio.mjs:184-220 n'est atteint qu'après les courses 75 s (:165) + 90 s (:179) ; il écrit id.m4a.part — même nom que lancerTelechargement (:83) et écrase la Map (:192) : risque de double dl/corruption si activé naïvement.
- SONORA_CACHE_MAX_BYTES déjà lu (audio.mjs:21) ; TS_CACHE_MAX constant (hls.mjs:8).

## Décisions
- **D1 — Prefetch HLS profondeur 2, réarmé à chaque transition.** prefetchNext : si hls.active, HEAD /musique/hls/seg/<id>.ts?d=… (réchauffe TS et m4a via genererTs→/musique/dl), sinon HEAD /musique/dl/ inchangé. Appels : dans startHls avant await playMedia() (:486), et à la transition détectée dans timeupdate (:788). Côté hls.mjs:140-158 : si req.method==='HEAD', lancer void genererTs(...) (dédup enCours :41) et répondre 200 immédiatement, sans corps. Justification : le warm doit cibler le cache réellement servi ; réarmé à la transition, il couvre skip, seek et lecture continue.
- **D2 — Caches 8 Go / 2 Go.** Unité systemd heid-dashboard : Environment=SONORA_CACHE_MAX_BYTES=8589934592 (aucune modif audio.mjs). hls.mjs:8 : const TS_CACHE_MAX = Number(process.env.SONORA_TS_CACHE_MAX_BYTES || 2*1024*1024*1024). Rejeté : constantes en dur (non ajustable sans rebuild).
- **D3 — Progressif opt-in interne pour le 1er titre.** hls.mjs:46 : URL ffmpeg → /musique/dl/<id>?progressif=1. audio.mjs handleAudio : si progressif=1, pas de cache, et !telechargementsEnCours.has(id) → sauter la course 75 s et entrer directement au bloc :184 ; si un dl est en cours, attendre sa promesse (comportement :177-182). Rejeté : raccourcir la course 75 s pour tous les GET (casse le Range/seek des clients directs qui exigent le fichier complet). Le consommateur interne (ffmpeg) lit séquentiellement sans Range → 200 sans Accept-Ranges acceptable.
- **D4 — yt-dlp : --http-chunk-size 10M** (anti-throttling YouTube) dans ytdlpArgs et les deux jeux d'args (:85-86, :186) ; N fragments via SONORA_YTDLP_FRAGMENTS (défaut 4). Honnêteté : gain nul sur le format 140 seul ; l'extraction (~2-3 s) reste incompressible — le vrai levier est D1/D3.

## Invariants
Jamais 2 yt-dlp pour un id (Map telechargementsEnCours + enCours préservées, le progressif ne s'active que Map vide) ; .ok reste le seul marqueur de cache valide ; Range/206 et fichiers complets servis aux clients externes, inchangés ; aucune dépendance npm.

## Cas limites
seek/skip loin → la transition timeupdate réarme le prefetch (2 titres suivants la nouvelle position) ; l'ancien warm continue, inoffensif (dédup). Pause → prefetch poursuit (HEAD gratuits). Cache partiel .part → cacheValide (:121-126) l'ignore ; D3 interdit la collision .part/progressif. Échec yt-dlp sur un warm → genererSilence (:67) inchangé, TTL 10 min. Éviction LRU : utimesSync déjà honoré (:130, hls:92) ; le warm ne périme pas les titres servis.

## Plan (étapes vérifiables, ordre de risque croissant)
1. **D2** : hls.mjs:8 + unité systemd + .env.example. Acceptation : elaguer déclenche à 8 Go/2 Go (test unitaire sur seuils), suite tests/*.test.mjs verte.
2. **HEAD seg** (hls.mjs:140-158) + test tests/hls-head.test.mjs : HEAD rend 200 < 50 ms, un seul spawn ffmpeg pour 2 HEAD concurrents, GET ultérieur sert le .ts. Acceptation : nouveau test + suite existante verts.
3. **D1 front** (engine.ts:878-885, :486-487, :788) : build web, vérifier sur iPhone que 2 HEAD seg partent au démarrage de file et à chaque transition. Acceptation : titre n+1 démarre < 300 ms après skip.
4. **D3** (hls.mjs:46 + audio.mjs:160-192) + test tests/progressif.test.mjs : premiers octets < 3 s sans attendre la fin ; interdiction si Map occupée ; .ok écrit seulement si complet. Acceptation : tests verts, seek direct 206 inchangé (test Range existant).
5. **D4** (audio.mjs:30-33, :85-86, :186). Acceptation : mesure dl complet <= avant ; suite verte.

## Métriques
log serveur dl id ttfb=…ms total=…ms dans le bloc progressif ; côté client, durée loadingTrack→playing (performance.now). Cibles : titres 2+ < 300 ms (hit TS 7 ms + transcode 0,07 s) ; 1er titre TTFB < 2,5 s (vs 4,5–5,3 s) ; taux d'éviction m4a/TS en baisse après D2 ; zéro double spawn yt-dlp (compteur Map).

## Hypothèses/risques
(H1) le format 140 streamé via -o - est fragmenté et décodable par ffmpeg en cours de téléchargement — le chemin :184 existant le suppose déjà, à confirmer au test 4 ; (H2) la mesure « prefetch jamais appelé » provient d'un build prod antérieur à :487 — sans incidence, D1 corrige les deux causes ; (R1) SONORA_CACHE_MAX_BYTES est aussi lu par alertes.mjs:11 : vérifier sa sémantique avant de passer l'env à 8 Go, sinon dissocier les variables ; (R2) warm profondeur 2 = jusqu'à 3 yt-dlp concurrents par client : bande passante partagée, à surveiller via la métrique total.
