# Design — Sonora v2.1 « features signature » (rév. 2, corrections Goldfish intégrées)

> Livrable de conception seul, aucune écriture disque. **Rév. 2** : corrige les 16 constats + secondaires du verdict NEEDS-WORK. Contexte ré-vérifié ce jour sur le checkout : le fil principal a déployé P1/P2 et S1/S3/S5/S7 côté serveur, S14 côté client, et `usePlayerSelector`/`UiState` (usePlayer.ts). Les zones sensibles sont désormais désignées **par symbole, jamais par numéro de ligne** (constat 3 : le fichier bouge). Acquis non re-spécifié ; seules les deltas restants sont conçus.

**Table de correction des constats** (preuve → section) : 1→§F2 (lecture `getSnapshot`) ; 2→§F3 (dédup vérifiée `telechargementsEnCours`) ; 3→§2/I1+§5 (symboles) ; 4→§8 (S14 supprimé, zéro diff) ; 5→§F5+§8 (`fermerBase` test-only) ; 6→§F7 (GET-only acquis) ; 7→§5 (`seekTo`) ; 8→§F1 (`onblocked`+timeout+reset) ; 9→§7/§8 (tests dès S0) ; 10→§F5/§8 (`PIPED_URL ??`) ; 11→§F5 (NULL≤0 acquis + `NULLIF` lecture) ; 12→§F5 (invalidation `pousseHistory` + dédup documentée) ; 13→§5 (liste par symbole, `radioImmediate` inclus) ; 14→§F4 (repli `navigator.onLine`) ; 15→§F1 (duration=0 omis) ; 16→§8 (App/DesktopPlayer câblés). Secondaires : CA radio §9, baseline §8/S0-b, mode end bridage §F2, F9 `ExecMainStatus`+`SONORA_DATA` §F9, fuite blob §F3.

## 1. Objectif et non-objectifs

**Objectif.** Livrer les deltas restants des 10 features signature sans dépendance npm, sans régression moteur/HLS/Subsonic/isolation/smoke, en consommant l'acquis serveur (P1/P2, stats/smart/radio/CarPlay) et client (progression DL, sélecteur, seek au relâchement, volume iOS, shuffle, pochettes HD).

**Non-objectifs.** Pas de gapless strict ; pas de cache audio Cache Storage (rejet §F4) ; pas de mesure de complétion réelle ; pas de traduction des paroles ; smart lists non modifiables et non exposées CarPlay ; pas de refonte store ; `hls.mjs`/`audio.mjs`/`index.mjs` zéro diff ; `star`/`scrobble` Subsonic : métadonnées remplies par le lot 0 (metaConnue/majMetaAsync/pousseHistory) — écart acté et documenté dans CHANGES-v2.1.md ; aucun autre diff Subsonic hors branche similar et PIPED_URL ?? ; **S14 (progression DL) non-objectif : déjà livré** (`downloadProgress` coexiste avec `downloading:boolean` — ne pas casser `disabled={downloading||downloaded}`).

## 2. Contraintes et invariants

| # | Contrainte / invariant | Preuve (symbole) |
|---|---|---|
| C1 | Aucune dépendance npm ; `frontend/package.json` inchangé ; SW maison | package.json |
| C2 | React 19 + TS strict ; `usePlayerSelector`/`UiState` **acquis** | usePlayer.ts (`usePlayerSelector`, `selectUiState`) |
| C3 | yt-dlp ≤ 2 : `lancerYtdlp` enveloppe déjà `ytPrendre/ytRendre` en `finally` (**acquis**) ; tout nouvel appel passe par `lancerYtdlp` | musique.mjs : `lancerYtdlp`, `ytPrendre`, `ytRendre` |
| C4 | Isolation : tout nouvel endpoint après le garde `userDuToken` (par symbole) | musique.mjs : `userDuToken`, `handleMusique` |
| C5 | i18n ×3 ; test d'égalité de keysets **existe dès S0** (acquis fil principal) ; clés `offlineBanner/retry/menu/playNext…` déjà là, clés features à ajouter | i18n.ts, lib/i18n.test.ts |
| C6 | Smoke prod vert (14/14 acquis) ; node:test 26/26 (`tests/v21.test.mjs`) ; QA 54/54 | smoke.mjs, tests/v21.test.mjs |
| **I1** | **Zones engine par symbole — zéro diff interne** : `bindMedia`, `startHls`, `startDirect`, `armStall`, `clearStall`, `onMediaError`, `maybeSkip`, `prefetchNext`, `playMedia`, `unlock`, `updatePositionState`, modèle `hls`. **Additifs autorisés** : liste exhaustive §5 | engine.ts (symboles) |
| **I2** | `this.media` = unique élément lié à l'état ; `fadeMedia` = pré-roll, jamais référencé par l'état | §F3 |
| **I3** | SW n'intercepte jamais `/api/*`, `/subsonic/*`, `/musique/dl/*`, `/musique/hls/*` ni 206 ; cache localStorage/IDB purgé au logout seul | §F4 |
| **I4** | Migrations douces idempotentes (`PRAGMA table_info`+`ALTER` nullable) ; `history.duration` **acquis** | musique.mjs : `ouvrirBase` |
| **I5** | Démarrage < 4 s non régressé ; modules sleep/crossfade s'arment après premier `playing`/`timeupdate` ; baseline protocolée §8/S0-b | §F2/F3 |
| **I6** | Repli si lot échelle non livré : `usePlayerSelector`→`usePlayer` ; `ActionSheet`→bouton PlayerSheet/ArtistView ; `libraryStale`→`navigator.onLine` seul | §F4/F6 |
| **I7** | **Sleep/crossfade lisent le temps relatif via `engine.getSnapshot()`**, jamais `media.currentTime` directement (HLS = flux continu) | §F2 (constat 1) |

**Hypothèses.** h1 lrclib CORS sans clé (vérifier S8 ; repli proxy `musique.mjs` si tombe). h2 `pwa-maj.js` hors dépôt, bannière indépendante. h3 noms unités systemd à confirmer avant S15. h4 routage hub/autonome sert `/musique/` (SW scopé). h5 iOS ≥ 16.4. h6 history ~124→milliers. h7 ntfy `127.0.0.1:2586`. **h8 (constat 2, vérifié)** : `audio.mjs` HEAD et GET partagent la map `telechargementsEnCours` (`lancerTelechargement` déduplique, branche `attente`) ; le hub prod déduplique HEAD depuis lot 0 → pas de double yt-dlp sur un même id.

## 3. Décisions justifiées

### F1 — Paroles (lrclib)
- `GET /api/get?track_name=&artist_name=[&duration=]` puis repli `/api/search`. **`duration` omis si `track.duration` est 0/inconnu** (constat 15) ; au repli search, tolérance |Δdurée| ≤ 5 s **seulement si durée connue**, sinon premier candidat `syncedLyrics`. Fetch direct client, timeout 8 s, sans clé.
- **Cache IDB store `lyrics`, base `sonora` v1→2.** Ouverture durcie (constat 8) : `req.onblocked` → reject ; `Promise.race(open, timeout 3 s)` ; à tout échec/timeout **`dbPromise = null`** ; `db.onversionchange` → `close()` + `dbPromise=null`. **Dégradation** : `lyricsGet` échoue → fetch live ; `downloadGet` échoue → `startDirect` retombe sur `/musique/dl`. TTL 30 j succès / 7 j échec ; plafond 500, éviction `fetchedAt`.
- `lib/lrc.ts` pur (multi-timestamps, tri, tags méta ignorés) + test vitest.
- **UI panneau PlayerSheet** (bouton `foot-actions`), fetch paresseux à l'ouverture ; ligne active via `usePlayerSelector(s=>s.currentTime)` ; **tap ligne → `engine.seekTo(time)` absolu** (constat 7, §5). Synchro HLS OK car `state.currentTime` relatif (I7). Dégradation instrumental/plain/absent traduite ×3 ; paroles en langue d'origine.

### F2 — Sleep timer (constat 1 + secondaire bridage)
- États `off|15|30|45|60|end`, état engine `sleep:{mode,endsAt}`, non persisté.
- **Module `audio/sleep.ts` installé APRÈS `bindMedia`** (constructeur, ligne additive) : à chaque tick il lit **`engine.getSnapshot()`** → `currentTime`/`duration` **relatifs**, jamais `media.currentTime` (I7). Le listener `timeupdate` additif se déclenche après celui de `bindMedia` ⇒ snapshot frais. + `setInterval` 15 s de rattrapage qui lit aussi le snapshot.
- Modes minutes : `endsAt = Date.now()+min×60000` ; à échéance → `media.pause()` + patch + toast.
- **Mode `end` à double mécanisme** : (a) foreground — si `snapshot.duration>0 && duration−currentTime ≤ 0,4 s` → pause ; (b) **filet arrière-plan** — listener `document.addEventListener('ended', h, true)` (**capture**) actif seulement si `mode==='end'` : `e.stopPropagation()` + `media.pause()` + patch + clear. Couvre le bridage OS qui fait manquer la fenêtre 0,4 s. **Zéro diff `bindMedia`/`playNext`.** Seek arrière réarme.
- **Limites honnêtes** : arrêt ≈ 0,4 s avant la fin ; en pause + écran verrouillé, timers bridés → arrêt possiblement tardif (rattrapage `visibilitychange`/tick). Le filet capture garantit l'arrêt au `ended` même bridé.
- UI `SleepPicker` (lune `foot-actions`) + compte à rebours `mm:ss` en-tête lecteur ; ×3.

### F3 — Crossfade direct uniquement (constat 2 + secondaire blob)
- Réglage `off|3|6|10`, défaut **off**, persisté `storage 'crossfade'` ; UI `setting-row` LibraryView.
- Deux éléments (I2) ; rejet Web Audio et un-seul-élément.
- **Pré-roll dédupliqué (constat 2, h8)** : même URL `/musique/dl/<id>` que le prefetch HEAD ; serveur `lancerTelechargement`/`telechargementsEnCours` déduplique. **Côté client** : une seule requête de pré-roll par transition, `AbortController` annulé sur skip/abandon ; flux pas prêt à la fin du fondu → **abandon**, chemin `ended→playNext` normal. `prefetchNext` inchangé.
- Mécanisme : armement sur tick (snapshot) si `!hls && crossfade>0 && repeat!=='one' && suivant && duration>2×fade && currentTime≥duration−fade` ; pré-roll `fadeMedia` (blob IDB sinon URL) volume 0 ; rampe égal-power sin/cos `setInterval` 100 ms ; **relais** : `fadeMedia.pause()` → `this.media.src=même source` → `currentTime=pos` → volume utilisateur → `play()` → patch `current/duration` + `pushHistory` + `updateMediaSession` + `persistQueue`.
- **Fuite blob corrigée** : relais appelle `this.revokeBlob()` avant `URL.createObjectURL` ; le module révoque sa propre URL blob de `fadeMedia` au relais ET à l'abandon.
- Watchdog inchangé ; `fadeMedia` a son propre `waiting/error` → abandon + volume primaire restauré. Échec relais → `onMediaError` existant relance `startDirect(current=déjà suivant)`.
- MediaSession : métadonnées au relais (ancien titre pendant N s, assumé). **HLS exclu** ; mention « indisponible en file HLS » quand `state.hls`.
- Démarrage : aucun travail avant premier tick (I5) ; CA baseline §8/S0-b.

### F4 — SW + offline (constat 14)
- `public/sw.js` maison, scope `/musique/`, enregistré `lib/sw.ts` depuis `main.tsx` **uniquement `import.meta.env.PROD`**.
- **Auto-versionnage sans build** : `install` fetch `/musique/`, extrait les assets hashés `assets/index-*`, précache shell+assets+manifest+icônes dans `sonora-shell-<hash maison>` ; `activate` purge les autres.
- Stratégies : navigations network-first (timeout 3 s) repli shell ; `/musique/assets/*` cache-first ; **API/subsonic/dl/hls jamais interceptés** (I3).
- MAJ sans coupure : pas de `skipWaiting` auto ; `updatefound`/`controllerchange` → `swUpdateReady` → `UpdateBanner` bouton « Recharger » **désactivé si `state.playing`** ; clic → `postMessage('SKIP_WAITING')`+reload. Coexiste `pwa-maj.js` (h2).
- **Bannière hors ligne (constat 14)** : consomme `stale{playlists,likes}` du N2 échelle **si livrés** ; **repli I6 sinon : `navigator.onLine` + listeners `online/offline` seuls** → bandeau `offlineBanner`. Boot offline : shell caché + `loadLocalUser` + téléchargements jouables.
- **Cache audio Cache Storage rejeté v1** : 206 non stockables, doublon LRU serveur 2 Go, offline réel couvert par IDB explicite.
- **F4b supprimé (constat 4)** : progression DL déjà livrée ; **zéro diff**, ne pas toucher `downloading:boolean`.

### F5 — Stats (constats 5, 10, 11, 12 — deltas sur l'acquis)
- **Acquis** : `history.duration` nullable + backfill ; `pousseHistory` NULL si durée ≤ 0 ; `statsPour` + `statsCache` 60 s ; `/stats`.
- **Delta 1** : `statsPour` → **`COALESCE(NULLIF(h.duration,0), NULLIF(tm.duration,0), 0)`**.
- **Delta 2** : à la fin d'un insert réussi dans **`pousseHistory`**, invalider `statsCache` pour le compte (clés préfixées `userId+':'`). Couvre API POST /history ET scrobble CarPlay sans diff Subsonic. **Dédup documentée** : relecture même titre < 60 s ignorée ⇒ libellé UI ×3.
- **Delta 3** : **`fermerBase()` exporté (test-only)** : `db.close(); db=null`. CA « 2 ouvertures ⇒ même état ».
- **Delta 4** : `PIPED_URL` `||` → **`??`** dans `musique.mjs`, `durees.mjs`, `subsonic.mjs`. `index.mjs` inchangé.
- UI `#/stats` : `StatsView` (cartes totaux, top titres `TrackList`, top artistes chips→`#/search/<nom>`, histogramme barres CSS), entrée LibraryView ; ×3.

### F6 — Radio (acquis + CA corrigé)
- **Acquis** : `/radio`, `radio`, `radioSync`, `radioImmediate`, `radioCache`.
- **Delta UI** : `engine.startRadio(track|artist)` → fetch `/radio` → `playTrack(seed,[seed,…],0)` ; menu ⋯ (`ActionSheet` C1) + hero ArtistView ; **repli I6** bouton `foot-actions` PlayerSheet. ×3.
- **CA timings corrigés** : seed titre Piped up < 7 s ; seed artiste froid < 15 s ; secours coupés < 1 s non vide.

### F7 — Smart playlists (acquis, constat 6)
- **Acquis** : `smartPour` + `/smart/:key` **GET-only** ; `top/recent/never`, isolation, virtuelles, noms traduits client.
- **Delta UI** : section LibraryView (3 cartes), route `#/smart/:key`, `SmartView` lecture seule `TrackList`. Pas d'exposition CarPlay. ×3.

### F8 — CarPlay (acquis)
- **Acquis** : `getSimilarSongs2/getSimilarSongs` branché sur `radioImmediate` ; `star`/`scrobble` : métadonnées lot 0 acté (voir §1) ; `majMetaAsync` intouché depuis. **Zéro delta**.

### F9 — Alertes ntfy (secondaires corrigés)
- `server/alertes.mjs` + timer `sonora-alertes` (5 min), indépendant du resolver.
- Conditions : (1) **cookies** — sonde `yt-dlp --simulate -f 140 <id en cache>` **conditionnelle** (dernier smoke KO OU ≥3 titres history 30 min sans `.m4a`) ; (2) **smoke** — `systemctl show -p ExecMainStatus,Result,ActiveState,ExecMainStartTimestamp --value heid-sonora-smoke.service` : alerte si `Result≠success` OU `ExecMainStatus≠0` OU **dernière exécution > 30 min / jamais exécuté** + mini-sonde HTTP ; (3) **cache > 90 %**.
- **Chemin état** : `alertes-etat.json` sous **`process.env.SONORA_DATA`**.
- Topic `heid-sonora`, POST `127.0.0.1:2586`, Title/Priority/Tags ; **dédup cooldown 6 h/clé** + « rétabli » unique ; ntfy down → log exit 0. Unités `docs/systemd/sonora-alertes.{service,timer}` versionnées ; h3 vérifié avant install.

### F10 — Vitesse + seek (constat 7, 16)
- `engine.setRate(r)` clamp [0.75,1.5], pas 0.75/1/1.25/1.5, `media.playbackRate` (+`fadeMedia`), persisté `storage 'rate'`, patch `rate`. `updatePositionState` transmet déjà `playbackRate`. **HLS : masqué + message**.
- **`engine.seekTo(seconds)` absolu** : HLS → `offsets[idx]+clamp(0,dur)` ; direct → clamp `media.currentTime`. **`engine.seekBy(delta)`** relatif ±10 s.
- Clavier **Shift+ArrowRight/Left** additifs `App.tsx` ; handlers `seekbackward/seekforward` additifs `updateMediaSession`. UI `RatePicker` PlayerSheet **+ DesktopPlayer**. ×3.

## 4. Alternatives rejetées

| Alternative | Rejet |
|---|---|
| Sleep lisant `media.currentTime` (rév.1) | Faux en HLS ; lecture `getSnapshot` relatif (I7) |
| Sleep mode end = seul tick 0,4 s | Bridage OS ; filet `ended` capture document |
| Sleep listener `ended` sur `this.media` + garde `playNext` | Ordre at-target fragile + modifie `playNext` |
| Crossfade sans dédup pré-roll | Double yt-dlp/.part ; h8 + abort client |
| Relais crossfade sans `revokeBlob` | Fuite d'URL blob |
| Web Audio crossfade / ping-pong d'éléments | Casse iOS/MediaSession ; listeners `bindMedia` resteraient sur l'élément d'origine (I2) |
| Crossfade HLS / gapless strict promis | Flux continu, offsets désynchronisés |
| `downloading:boolean→number` (rév.1 S14) | Régressif (`disabled`) ; déjà livré en coexistence |
| Idempotence « 2 ouvertures » sans `fermerBase` | Singleton impossible |
| `COALESCE(h.duration,…)` sans NULLIF | 0 résiduel compté comme acquis |
| statsCache invalidé seulement POST /history | Scrobble CarPlay contourne ; invalidation dans `pousseHistory` |
| `PIPED_URL ||` | `''` falsy → défaut 8081 non hermétique |
| Bannière offline sans repli | Contraire I6 ; repli `navigator.onLine` |
| lrclib `get` avec `duration=0` | Omettre le paramètre |
| Tap paroles via `seekBy`/`seekRatio` | `seekTo` ajouté |
| IDB v2 sans `onblocked`/timeout/reset | Gèle downloads+paroles |
| « vitest à chaque étape » avant S0 | Tests purs créés dès S0 |
| CA radio « ≥10 titres <3s » | Contredit timeout 6 s |
| F9 `ExecMainStatus=0` seul / état `data/` en dur | Faux négatif never-run + chemin `SONORA_DATA` |
| Proxy paroles systématique / workbox / plugin SW / table stats / smart matérialisées / hook resolver / sonde chaque tick / Arrows=seek | Inchangé rév.1 |

## 5. Interfaces et flux de données (par symbole, exhaustif)

**Frontend — ajouts/deltas :** `lib/lrc.ts` ✚ parseLrc ; `lib/idb.ts` v1→2 store lyrics + lyricsGet/lyricsPut ; `lib/lyrics.ts` ✚ fetchLyrics ; `lib/api.ts` ✚ stats/smart/radio ; `audio/engine.ts` SYMBOLES ADDITIFS EXHAUSTIFS (I1) : constructor +installSleep()+installCrossfade() après bindMedia sans le modifier ; PlayerState/initialState +sleep{mode,endsAt} +crossfade:number +rate:number +swUpdate:boolean ; méthodes ✚ setSleep, setCrossfade, setRate, seekBy(delta), seekTo(seconds), startRadio ; updateMediaSession +setActionHandler seekbackward/seekforward ; `audio/sleep.ts` ✚ (lit getSnapshot ; ended capture document) ; `audio/crossfade.ts` ✚ (fadeMedia, revokeBlob propre) ; `lib/sw.ts` ✚ ; `public/sw.js` ✚ ; components ✚ LyricsPanel, SleepPicker, RatePicker, UpdateBanner ; views ✚ StatsView, SmartView ; hooks routes stats/smart ; câblage App.tsx (Shift+Arrows, routes, UpdateBanner), DesktopPlayer.tsx (RatePicker, seek±10), PlayerSheet.tsx (LyricsPanel/SleepPicker/RatePicker/radio repli), LibraryView.tsx (crossfade, liens stats/smart, reset SW).

**Serveur — deltas sur l'acquis (symboles) :** `musique.mjs` : `fermerBase` ✚ (test-only) ; `pousseHistory` (+invalidation `statsCache`) ; `statsPour` (`NULLIF`) ; `PIPED_URL ??`. `durees.mjs`, `subsonic.mjs` : `PIPED_URL ??`. `server/alertes.mjs` ✚ ; `docs/systemd/sonora-alertes.{service,timer}` ✚. **Acquis zéro diff** : migrations, caches, smart GET-only, radio/radioSync/radioImmediate, getSimilarSongs2, lancerYtdlp sémaphore, P1/P2. **Zéro diff** : index.mjs, audio.mjs, hls.mjs. star/scrobble : métadonnées lot 0 acté (§1/F8).

**Flux clés :** Paroles ouverture→IDB(TTL)→lrclib get(durée omise si 0)→search→parse→ligne active via sélecteur→tap=seekTo. Crossfade tick(snapshot) T−N→pré-roll dédupliqué(abort)→rampe→relais+revokeBlob→patch/MediaSession/history. Sleep tick(snapshot)/interval→pause ; mode end filet ended capture. SW install(hash assets)→activate purge→updatefound→bannière(pause requise). Stats pousseHistory→invalidation cache→/stats NULLIF. Alertes timer→3 checks→dédup 6h→ntfy.

## 6. Risques et modes de défaillance

| # | Risque | Mitigation |
|---|---|---|
| R1 | lrclib CORS/429/panne (h1) | Cache négatif 7j + Réessayer ; repli proxy additif GET /api/mus/lyrics si h1 tombe |
| R2 | Paroles autre version | Tolérance Δdurée si connue ; plain si pas de synced |
| R3 | IDB v2 bloqué | onblocked+timeout 3s+dbPromise=null+versionchange ; dégradation lyrics live / DL streaming |
| R4 | Sleep tardif pause verrouillée | Limite honnête ; rattrapage visibilitychange ; filet ended capture |
| R5 | Relais crossfade audible / double décodage | CA ≤100ms ; abandon sur waiting/error ; défaut off ; duration≤2×fade désactivé |
| R6 | Faux stall watchdog pendant fondu | Primaire progresse (tick) ; test manuel 60s |
| R7 | SW shell périmé | HTML network-first ; caches versionnés ; bannière ; reset LibraryView |
| R8 | SW intercepte audio/HLS iOS | Allowlist stricte I3 |
| R9 | Stats sous-estiment (NULL/0) | Backfill+NULLIF+COALESCE ; libellé honnête |
| R10 | Radio artiste froide lente | radioSync immédiat + warm async ; CA <15s |
| R11 | Spam ntfy / faux négatif smoke | Cooldown 6h + rétabli unique ; sonde conditionnelle ; ExecMainStatus+Result+fraîcheur |
| R12 | Nom unité systemd faux (h3) | Vérif avant S15 ; repli mini-sonde HTTP |
| R13 | Régression démarrage | Armement post-playing ; baseline S0-b |
| R14 | Diff engine hors zones | Revue git diff par symbole |
| R15 | Fuite blob URL crossfade | revokeBlob primaire + URL fadeMedia révoquée relais/abandon |

## 7. Stratégie de test

1. Unitaires frontend (vitest, acquis S0) + ajouts : lib/lrc.test.ts, lib/lyrics.test.ts, audio/sleep.test.ts, audio/crossfade.test.ts, lib/idb.test.ts. Test i18n keysets couvre les nouvelles clés.
2. Serveur (node:test, harnais hermétique après ??) : tests/v21.test.mjs acquis 26/26 + tests/v21b.test.mjs : idempotence via fermerBase ; NULLIF ; invalidation statsCache ; isolation ; perf <100ms/10k ; radio timings ; sémaphore ≤2.
3. SW : protocole manuel scripté DevTools.
4. Smoke prod vert après chaque étape serveur ; node:test+typecheck+vitest à chaque étape.
5. Manuel transverse : 2 comptes×3 langues ; iOS réel HLS ; Android verrouillé ; CarPlay Amperfy ; ntfy bout-en-bout.

## 8. Plan d'implémentation ordonné

**Acquis fil principal (zéro diff) :** P1/P2 serveur ; S1/S3/S5/S7 serveur ; S14 client ; usePlayerSelector/UiState ; seek au relâchement ; volume iOS ; shuffle Fisher-Yates ; pochettes HD ; tests purs S0 + v21 26/26 ; smoke 14/14 ; QA 54/54.

| Étape | Fichiers | CA |
|---|---|---|
| S0-b Baseline démarrage (bloquant) | aucun (docs/perf/) | 3 runs pointerup→playing médians archivés AVANT crossfade |
| S1b Deltas stats serveur | musique.mjs (fermerBase, invalidation, NULLIF, ??), durees.mjs/subsonic.mjs (??), tests/v21b.test.mjs ✚ | Idempotence ; 0 non compté ; stats fraîches ; hermétique ; verts |
| S2 Stats UI | lib/api.ts, lib/hooks.ts, views/StatsView.tsx ✚, App.tsx, views/LibraryView.tsx, lib/i18n.ts ×3 | #/stats 2 comptes, barres CSS, libellé dédup ; i18n vert |
| S4 Smart UI | views/SmartView.tsx ✚, lib/hooks.ts, views/LibraryView.tsx, lib/api.ts, lib/i18n.ts | 3 cartes→lecture seule ; reload conserve ; POST→404 |
| S6 Radio UI | audio/engine.ts (startRadio), lib/api.ts, PlayerSheet.tsx ou ActionSheet, views/ArtistView.tsx, App.tsx, lib/i18n.ts | seed en tête, lecture lancée ; timings §9 |
| S8 Paroles fondations | lib/lrc.ts ✚+test, lib/lyrics.ts ✚+test, lib/idb.ts (v2 durci)+test | Tests verts ; h1 vérifié sinon repli R1 ; open bloqué→dégradation |
| S9 Paroles UI | components/LyricsPanel.tsx ✚, PlayerSheet.tsx, App.tsx, DesktopPlayer.tsx, engine.ts (seekTo), lib/i18n.ts | Ligne active direct+HLS ; tap=seekTo ; ×3 ; 0 fetch fermé |
| S10 Sleep | audio/sleep.ts ✚+test, engine.ts, SleepPicker.tsx ✚, PlayerSheet.tsx, App.tsx, DesktopPlayer.tsx, lib/i18n.ts | ±2s verrouillé ; mode end ≤0,4s direct+HLS+filet ; pas de suivant |
| S11 Vitesse+seek | engine.ts (setRate, seekBy, seekTo, handlers), RatePicker.tsx ✚, PlayerSheet.tsx, DesktopPlayer.tsx, App.tsx, lib/i18n.ts | 1.25× persisté ; lock-screen cohérent ; Shift+→=+10s ; masqué HLS |
| S12 Crossfade | audio/crossfade.ts ✚+test, engine.ts, views/LibraryView.tsx, lib/i18n.ts | Fondu 6s ; relais ≤100ms ; 0 blob orpheline ; HLS inchangé ; démarrage <4s et ≤baseline+10% |
| S13 SW+offline | public/sw.js ✚, lib/sw.ts ✚, main.tsx, UpdateBanner.tsx ✚, views/LibraryView.tsx, App.tsx, lib/i18n.ts | Mode avion boot+bibliothèque+DL ; bannière ; reload impossible en lecture ; /api jamais caché |
| S15 Alertes ntfy | server/alertes.mjs ✚, docs/systemd/sonora-alertes.{service,timer} ✚ | KO→1 message ; re-tick→0 ; rétabli→1 ; never-run→alerte ; état SONORA_DATA |
| S16 Transverse V | aucun | §9 2 comptes×3 langues ; diff par symbole ; smoke vert |

**S14 supprimé.** Effort restant : **10–14,5 j**.

## 9. Critères d'acceptation observables

| Propriété | État observable | Deux exécutions | Résultat attendu |
|---|---|---|---|
| Paroles synchro | Ligne vs currentTime | direct ; HLS iOS | ±1s ; tap=seekTo ; 2ᵉ ouverture 0 requête |
| Paroles durée inconnue | Requête lrclib | duration=0 ; connue | (1) paramètre absent ; (2) présent |
| Dégradation paroles | Panneau+cache négatif | instrumental ; inexistant ×2 | ×3 ; 1 seul fetch |
| IDB bloqué | Console+lecture | onglet v1 ouvert ; après fermeture | timeout→reset→streaming/live ; upgrade ok |
| Sleep minutes | Horloge+playing | allumé ; verrouillé Android | ±2s ; toast ×3 ; non persisté |
| Sleep fin | Position+file | direct ; HLS ; bridé | ≤0,4s via snapshot ; filet ended ; pas de suivant |
| Crossfade | Audio+logs+blobs | 6s direct ; HLS | chevauchement ; ≤100ms ; 0 orpheline ; HLS identique |
| Pré-roll dédup | yt-dlp+.part | HEAD puis GET même id ; froid | un seul yt-dlp/.part ; abort client |
| Démarrage | pointerup→playing ×3 | off ; 6s | <4s et ≤baseline+10% |
| Offline boot | PWA mode avion | après session ; après nouveau build | boot+bibliothèque+bannière+DL ; nouveau shell |
| MAJ sans coupure | Bannière+bouton | pendant lecture ; pause | désactivé/lecture continue ; clic→reload une fois |
| SW n'intercepte pas audio | Cache/Network | direct ; HLS | aucune entrée dl/hls/api ; 206 inchangés |
| Stats | /stats+vue | A seedé ; B vierge ; 10k | exacts ; zéros ; <100ms |
| NULLIF+dédup | history+stats | duration=0 ; même titre ×2 à 30s ; stats après POST | NULL non compté ; 1 ligne ; cache invalidé |
| Idempotence | base | ouvrir→fermer→ouvrir ; backfill rejoué | même état |
| Hermétique | harnais | '' ; unset | off ; défaut 8081 |
| Radio | file+temps | titre Piped up ; artiste froid ; coupés | <7s ; <15s ; <1s non vide ; ≤2 spawns |
| Smart | listes+écriture | never après écoute ; POST | quitte never/entre top ; 404 ; isolation |
| CarPlay | similar+diff | froid ; chaud | non vide <500ms ; diff limité |
| ntfy | messages | KO ×2 ticks ; rétabli ; never-run | 1 ; 1 rétabli ; alerte ; état SONORA_DATA |
| Vitesse/seek | son+position | 1.25×+Shift+→ ; HLS | audible+pitch+10s ; masqué+message |
| i18n | vitest | complet ; clé ES retirée | vert ; rouge |
| Zones intactes | git diff par symbole | après étape ; S16 | package.json/hls/audio/index vides ; engine ⊆ §5 |

---

**Synthèse rév. 2.** Les 16 constats sont corrigés et vérifiés sur l'état courant : sleep lit le temps relatif getSnapshot + filet ended capture ; pré-roll crossfade dédupliqué + abort client + revokeBlob ; zones engine par symbole ; S14 supprimé ; fermerBase test-only ; smart GET-only acquis ; seekTo absolu ; IDB durci ; tests dès S0 ; PIPED_URL ?? ; NULL≤0 + NULLIF ; invalidation statsCache dans pousseHistory + dédup documentée ; repli navigator.onLine ; duration omis si 0 ; App/DesktopPlayer câblés. Secondaires : CA radio réels, baseline S0-b, mode end bridage, F9 ExecMainStatus+fraîcheur+SONORA_DATA, fuite blob. Acquis consommé sans re-spécification ; deltas restants petits, vérifiables, chaque propriété avec son test observable.