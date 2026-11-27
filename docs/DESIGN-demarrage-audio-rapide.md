# DESIGN — Démarrage audio quasi instantané (Sonora)

## Objectif
Pour un titre absent du cache, `<audio>` reçoit les premiers octets en ~1 s via Piped local + proxy Range vers googlevideo, pendant que yt-dlp remplit le cache en arrière-plan. Aucune régression seek/Range, HLS iOS, prefetch, sécurité.

## Contraintes dures
Zéro dépendance npm nouvelle ; HTTP sortant uniquement côté serveur ; URL client toujours `/musique/dl/<id>` ; Range/seek fonctionnel ; fallback yt-dlp obligatoire ; HLS iOS intact (ffmpeg lit `/musique/dl`) ; cache `data/musique` + prefetch HEAD conservés ; hôte Piped fixe (env admin), pas de SSRF ouvert.

## Invariants
1. `id` validé `/^[A-Za-z0-9_-]{11}$/` avant tout appel réseau.
2. Sémantique Range identique en fast path et en cache : 206 + `Content-Range` exact, suffixe `bytes=-N` supporté, 416 propagé.
3. Le fallback n'est possible qu'**avant l'envoi des en-têtes** au client ; après, le corps est best-effort (troncature détectable via `Content-Length`, le client ré-émet un Range).
4. Un seul yt-dlp par id (map `telechargementsEnCours`).
5. `SONORA_FAST=0` désactive tout le fast path.
6. HEAD ne touche jamais Piped : prefetch silencieux inchangé.

## Décisions (avec justification)

**D1 — Architecture à deux étages conservée : résolution Piped → proxy Range → cache yt-dlp en fond.** Latences mesurées (1,14 s + 91 ms) compatibles avec la cible ~1 s. L'ébauche est saine dans son ordre cache → fast → legacy. *Rejeté* : (a) tee des octets proxifiés vers disque pour constituer le cache — les Range partiels/désordonnés des seeks ne permettent pas d'assembler un fichier fiable, et le moov n'est pas faststart ; (b) exposer l'URL googlevideo au client — viole URL locale + CORS + TTL ; (c) pré-résolution massive — bande passante et rate-limit.

**D2 — Filtrer les flux à `audio/mp4` (m4a/AAC), pas « meilleur bitrate ».** L'ébauche trie uniquement par bitrate et peut choisir opus/webm : **illisible sur Safari iOS** en direct, et `-c:a copy` vers mpegts copierait de l'opus dans du TS → régression HLS iOS. Décision : ne garder que `mimeType` commençant par `audio/mp4` (préférer itag 140 si présent), sinon `null` → fallback.

**D3 — Validation anti-SSRF de l'URL rendue par Piped.** L'ébauche accepte tout `https?:` et la requête sans garde : un Piped compromis/mal configuré devient un proxy SSRF (http, IP privées, metadata). Décision : https strict + suffixe d'hôte `googlevideo.com` + réutiliser `netguard.mjs` (`guardUrl` : IP privées rejetées, pin DNS anti-rebinding ; `pinnedFollow` : redirects re-gardés, Range passé en `extraHeaders`). Hôte Piped fixe par env = confiance admin, acceptable. Override test `SONORA_FAST_ALLOW_INSECURE_UPSTREAM=1` autorisant http/loopback **uniquement** pour le harnais.

**D4 — Contrat de fallback strict et purge du cache d'URL.** `proxyRapide` résout `false` (→ legacy) si : statut ≠ 200/206 ; **200 reçu alors qu'un Range était demandé** ; `Content-Length`/`Content-Range` absent ; refus garde ; timeout. Sur 403/410 : `cache.delete(id)` + **une** re-résolution bornée avant fallback. Redirects googlevideo suivis via `pinnedFollow` plutôt qu'échouer.

**D5 — Lancer le téléchargement de cache dès l'entrée GET non cachée, en parallèle de la résolution.** Dédoublé via la map existante ; le chronomètre yt-dlp part à t=0, ce qui borne le coût du fallback. Double bande passante acceptée : ~2× le bitrate audio par titre non caché, bornée par la durée d'écoute réelle côté proxy et 120 s côté yt-dlp. *Rejeté* : différer le cache à la fin d'écoute (le titre suivant ne serait jamais chaud).

**D6 — Aborts et timeouts.** `req.on('close')` détruit la requête amont ; timeout socket 15 s = inactivité ; erreur mid-corps → `res.destroy()`, pas de fallback possible (invariant 3). Pas de retry mid-corps : le client ré-émet un Range, servi par le cache devenu chaud.

**D7 — HLS et HEAD inchangés structurellement.** ffmpeg émet GET `bytes=0-` puis Range suffixe pour le moov en queue : le proxy transpose ces Range à googlevideo qui les honore (TTFB 91 ms mesuré). Aucune modification de `hls.mjs`.

## Interfaces (inchangées, contrat précisé)
- `rapideActif() → boolean`
- `resoudreRapide(id) → {url, mime:'audio/mp4', at} | null` — URL gardée, m4a only, TTL 30 min, purge sur 403.
- `proxyRapide(req, res, src) → Promise<boolean>` — `true` = en-têtes envoyés, requête consommée ; `false` = rien écrit, l'appelant **doit** fallback.
- `handleAudio` : seul point d'orchestration ; ordre cache → (lancement fond ∥ fast) → legacy.

## Flux de données
`<audio>` → GET `/musique/dl/<id>` (Range) → cache hit ? `servirFichier` : sinon `void lancerTelechargement` ∥ `resoudreRapide` (Piped 127.0.0.1:8081, 5 s max) → URL gardée → `pinnedFollow` googlevideo avec Range client → 206/200 + longueur → pipe ; échec avant en-têtes → chemin legacy. En fond : yt-dlp → `.part` → `finaliser` → `.ok` → LRU.

## Risques
- Expiration/rate-limit googlevideo en cours d'écoute → troncature mid-corps ; atténué par cache chaud + retry Range client.
- Piped lent/HS : +5 s avant fallback mais yt-dlp déjà parti ; envisager timeout résolution 3,5 s.
- Faux positifs garde DNS (googlevideo sur IP inhabituelle) → fallback, jamais d'échec dur.
- Hypothèses : Piped `/streams` expose `audioStreams[].{url,mimeType,bitrate,itag}` ; googlevideo honore Range et fournit Content-Length.

## Stratégie de test (observables, harnais = spawn `index.mjs` + faux Piped + faux upstream Range + faux yt-dlp)
1. Démarrage : GET non caché `bytes=0-` → 206, octets = fixture, **avec yt-dlp cassé** ; < 1 s en local.
2. Seek : `bytes=100-199` → 206 slice exact + Content-Range ; suffixe `bytes=-4` → 206.
3. Fallback résolution : Piped 500 → 200 servi via faux yt-dlp ; fichier `.ok` créé.
4. Fallback upstream 403 → legacy ; 2ᵉ requête : compteur Piped incrémenté (purge TTL observée).
5. Filtre mime : Piped offre opus bitrate supérieur + m4a → l'upstream m4a est touché, jamais l'opus.
6. Cache fond : après fast GET, `.m4a`+`.ok` existent ; Piped éteint, GET suivant → 206 local.
7. SSRF : Piped rend `http://127.0.0.1:x`, `http://169.254.169.254/`, `https://evil.com/x` → fallback, compteurs upstream à 0.
8. HEAD → 200 `no-store`, compteur Piped inchangé, un seul yt-dlp lancé.
9. Abort : client détruit la connexion mid-corps → connexion upstream fermée, serveur sain.
10. Range répondu 200 par upstream → fallback ; `SONORA_FAST=0` → compteur Piped 0.

## Plan d'implémentation (étapes petites et vérifiables)
1. `server/stream-fast.mjs` — filtre m4a/140 + garde `guardUrl`/allowlist googlevideo + flag test. *Acceptation* : tests unitaires 5, 7, 11 verts.
2. `server/stream-fast.mjs` — `pinnedFollow` avec Range, contrat `false` strict, purge 403 + une re-résolution. *Acceptation* : unitaires 2, 4, 10 verts.
3. `server/audio.mjs` — lancement fond à l'entrée GET non cachée, suppression du lancement post-proxy. *Acceptation* : e2e 1, 3, 6 verts ; un seul process yt-dlp par id.
4. `tests/stream-fast-e2e.test.mjs` — harnais complet, cas 1–10. *Acceptation* : suite verte.
5. `server/index.mjs` — documenter `SONORA_FAST`, `PIPED_INTERNAL_URL`, flag test. *Acceptation* : revue ; smoke vert.
6. Vérification non-régression — suite complète + contrôle manuel HLS iOS. *Acceptation* : zéro régression, TTFB audio non caché ~1 s.

## Critères d'acceptation observables
- Fast path : GET non caché sans yt-dlp → 206/200 avec octets exacts en < 1 s (local).
- Contrat : 200-sur-Range, longueur absente, statut ≠ 200/206 → fallback legacy (fichier servi par yt-dlp).
- Purge : upstream 403 → requête suivante ré-interroge Piped (compteur +1).
- Sécurité : URL non-googlevideo/privée/http → 0 connexion amont, fallback.
- HEAD : 0 appel Piped, 1 yt-dlp.
- Désactivation : `SONORA_FAST=0` → 0 appel Piped.

## Addendum après mesures réelles (2026-11-27)

- Piped local (127.0.0.1:8081) répond en ~1,1–1,7 s mais renvoie 0 audioStreams pour tous les titres testés (5/5, deux appels chacun) : cette instance ne peut pas servir de résolveur.
- yt-dlp -g : 4,6 s (plancher d extraction) ; les clients alternatifs (android/ios/tv/mweb/web_embedded/tv_embedded/android_vr/web_creator/ios_music, player_skip=js) échouent ou ne réduisent pas le temps.
- Conclusion : le fast-start Piped + Range est implémenté, testé (unitaires 4/4, e2e 206 + X-Sonora-Fast sans yt-dlp) mais désactivé par défaut (SONORA_FAST=1 pour l activer) tant qu un résolveur fonctionnel n est pas disponible ; sinon il ajoute ~1,4 s avant le repli.
- Le gain réel livré reste le réarmement du prefetch à chaque transition HLS (v2.9.4) : les titres suivants sont chauds, donc zéro blanc entre morceaux.

### Corrections après critique (Goldfish, 14 constats)
- Allowlist par saut (redirects re-gardés), m4a obligatoire, 416 transmis, purge 403 + une re-résolution, plafond 6 flux simultanés, 127.0.0.1 uniquement sous flag de test.
- proxyRapide(req,res,src,id) : l id est nécessaire à la purge ; interface mise à jour ici.