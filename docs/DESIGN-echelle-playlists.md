# Design Sonora — rév. 4 : tranchage N1–N5 + lot « échelle + playlists entretenables »

> Livrable de conception seul (aucun fichier écrit, aucun code implémenté). Ancres vérifiées par lecture directe le 24/11/2026 **après déploiement des lots 0+1** par le fil principal ; SHA non disponible (session lecture seule sans shell) — les numéros de ligne ci-dessous font foi pour l'état actuel.
> **Acquis lots 0+1 : non re-spécifiés, listés en §2bis.** Cette rév. 4 corrige les 18 constats de la revue 3 ; chaque correction porte le numéro du constat.

## 1. Objectif et non-objectifs

**Objectif.** Rendre N1–N5 implémentables sans contradiction, et livrer le lot playlists : ordre source persistant (`position`), renommage, retrait avec undo **à écriture immédiate**, import YouTube, export M3U/JSON — sans dépendance ajoutée.

**Non-objectifs.**
- UI de réordonnancement manuel : **l'endpoint `reorder` est créé par P2** (il n'existe pas aujourd'hui — corrige le secondaire §1) ; l'UI ±1 est différée.
- Pas de refonte du store, pas de virtualisation, pas d'IndexedDB recherche.
- `audio.mjs` et `hls.mjs` intouchés (contrainte dure) ; leur pool yt-dlp/ffmpeg de téléchargement reste **séparé** du pool métadonnées (§P2, constat 11).
- Pas de jsdom / Testing Library : C1 ferme → tests purs + CA manuels chiffrés (§7, constat 18).
- Lecture audio hors ligne : inchangée.

## 2. Contraintes et invariants

| # | Contrainte / invariant | Preuve actuelle |
|---|---|---|
| C1 | Aucune dépendance npm ; frontend/package.json inchangé. vitest déjà devDep (ligne 23) → tests **purs** gratuits, tests DOM **non** (constat 18) | frontend/package.json:11,23 |
| C2 | React 19, TS strict, `useSyncExternalStore` | usePlayer.ts:1-6 |
| C3 | **Smoke = 14 checks** (smoke.mjs:40-161, sortie `total/failed` lignes 163-165). CA : `total=14, failed=0`, compte inchangé. QA prod api.py : 54/54 inchangé (constat 14) | smoke.mjs compté |
| C4 | Isolation 2 comptes : garde `user_id` sur tout endpoint playlist | musique.mjs:550,576,592 |
| C5 | DOM ≤ 100 lignes **au chargement à froid** (défini §N3) ; renders App ≤ 2/min en lecture hors interaction | rév. 2 |
| C6 | i18n : couverture de clés **prouvée par test** ; qualité de traduction = passe manuelle (le test ne la prouve pas — constat 2, honnêteté) | i18n.ts:139-141 |
| C7 | Pool yt-dlp **métadonnées** ≤ 2 : `lancerYtdlp` + `ytPlaylist` enveloppés ; `audio.mjs` hors pool (§P2) | musique.mjs:145-155,161,249-254 ; audio.mjs:90,188 |
| **I1** | `patch` alloue toujours un nouvel objet → l'identité de référence de l'état **est** la version | engine.ts:122-125 |
| **I2** | `getSnapshot` du sélecteur : même référence tant que la tranche est sémantiquement inchangée ; **la fonction `getSnapshot` elle-même n'est jamais recréée** (constat 1) | recette §N1 |
| **I3** | Le cache par compte n'est **jamais purgé automatiquement** : ni fetch échoué, ni logout (reconnexion hors ligne préservée — constat 15). L'isolation vient des clés nommées par compte + patch d'état | storage.ts:20-22, engine.ts:220-230 |
| **I4** | `position` : non-null **à l'écriture** (4 sites, §P1), ordre d'affichage strictement croissant, **trous autorisés après DELETE** (densité abandonnée — constat 6), append = MAX+1 | §P1 |
| **I5** | Zéro closure par ligne : délégation ; `data-index` = index **absolu** dans le tableau source (constat 16) | §N1 |
| **I6** | « ligne » = élément DOM de classe `.track` (y compris les rangées artistes de SearchView qui portent cette classe) ; `.pl-card`, `.q-row` exclus (secondaire) | SearchView.tsx:130 |

### 2bis. Acquis lots 0+1 — NE PAS REFAIRE (constat 12, contexte mouvant)

`refreshLibrary` catch(null) + persistance favs/playlists (engine.ts:239-252, cache playlists chargé engine.ts:163) ; toasts/aria via `tr` ; bandeau session expirée (App.tsx:143-145) ; ErrorBoundary ; seek au relâchement + volume masqué iOS ; retour ‹ + `useScrollMemory` (hooks.ts:35-41, PlaylistView.tsx:20,45) ; deps `lang` retirées (PlaylistView.tsx:32) ; outils file vider/enregistrer (engine.ts:532-547) ; **shuffle Fisher-Yates + restauration `preShuffle`** (engine.ts:520-530,769-773) ; pochettes HD `artOf`/`Art.tsx` ; skeletons ; égaliseur ; progression download ; `__APP_VERSION__` ; HLS durées réelles ; smoke React-aware + legacy (14 checks) ; QA 54/54 ; **clés i18n du lot futur déjà ajoutées aux 3 dictionnaires** (`showMore, offlineBanner, playNext, addToQueue, menu, importYouTube, importHint, truncated, exportM3U, exportJSON, rename, likedView, filterLikes, shufflePlay, localResults` — i18n.ts:131-134 pour ES).

## 3. Décisions justifiées

### N1 — Sélecteur : cache jamais keyed sur la référence du sélecteur (constats 1, 10, 16, 17)

**Recette corrigée.** Le cache est créé **une seule fois par instance de hook** (`useRef` initialiseur) et n'est **jamais recréé**. `select` et `eq` sont tenus dans des refs mises à jour à chaque render. `getSnapshot = useCallback(() => cache.read(engine.getSnapshot(), selectRef.current, eqRef.current), [])` — **identité stable pour toujours**, donc aucune boucle `useSyncExternalStore` même avec sélecteur inline.

`cache.read(source, select, eq)` (fabrique pure `lib/selector.ts`) :
- Entrée mémorisée `{ source, select, value, has }`.
- Si `has && source === entrée.source && select === entrée.select` → retourner `entrée.value` (stabilité entre notifications).
- Sinon `next = select(source)` ; si `has && eq(entrée.value, next)` → **conserver l'ancienne référence** ; sinon `value = next`. Mémoriser `{ source, select, value }`. Retourner `value`.
- Un sélecteur inline change d'identité à chaque render → recalcul, mais `eq` (shallowEqual maison) conserve la référence de valeur ⇒ `getSnapshot` stable **en valeur** entre notifications. La clé de recalcul inclut `select`, la clé de **valeur** n'en dépend pas.

**Preuve (test pur, sans React)** : (a) deux `read` même source même select ⇒ `Object.is` vrai ; (b) 100 appels avec sélecteurs inline **fraîchement alloués mais sémantiquement identiques**, source patchée `currentTime` seul ⇒ même référence de valeur à chaque fois ; (c) patch `playing` ⇒ référence nouvelle ; (d) `getSnapshot` du hook : identité vérifiée par test de la fabrique (la fonction ne capture que des refs).

**Tranche App** : `UiState = Omit<PlayerState, 'currentTime' | 'duration' | 'volume'>` + `stale` (§N2). App (App.tsx:22) s'abonne via `usePlayerSelector(selectUiState, shallowEqual)`. **Les 11 consommateurs de `state: PlayerState` sont tous convertis** (constat 17, grep vérifié) : `HomeView, SearchView, LibraryView, PlaylistView, ArtistView, MiniPlayer, QueueSheet, AddSheet, PlayerSheet, DesktopPlayer, DesktopSidebar` (DesktopSidebar.tsx:8). MiniPlayer/DesktopPlayer/PlayerSheet s'abonnent eux-mêmes à `currentTime/duration/volume` (sélecteurs primitifs) ; les autres reçoivent `UiState`.

**TrackRow réactif à la langue** (constat 10) : suppression de la lecture non réactive `engine.getSnapshot().lang` (TrackRow.tsx:20) ; **prop `lang: Lang`** passée par la vue (réactive via App). `memo` compare `lang` ⇒ changement de langue re-rend les lignes (interaction utilisateur, hors budget lecture).

**Délégation — spec d'index** (constat 16) : `data-index` = index **absolu** dans le tableau source complet (pas relatif au lot). `TrackList` rend `tracks.slice(0, batchCount*100)` en conservant l'index absolu. Dispatch : `i = Number(dataset.index)` ; garde `0 ≤ i < listRef.current.length` ; `track = listRef.current[i]` ; **contrôle croisé** `track.id === dataset.id`, sinon repli `findIndex` par id (DOM périmé). Doublons d'id (résultats Piped) : l'index départage ; `key = id + index` (pattern existant PlaylistView.tsx:57). CA manuel : cliquer la ligne 150 après 2 lots → le mini-player affiche le titre 150 (§7).

**Réorganisation anti-constat 5** : la délégation + `TrackList` + lots + memo = **étape S0 structurelle, toujours exécutée** (prérequis de C1 menu ⋯, P2 retrait, et C5 DOM ≤ 100). Le gate A1.0 ne peut annuler que **A1a/A1b (sélecteur + abonnements)**. Si A1 est annulé, C1/P2 gardent leur mécanisme : S0 ne dépend pas du sélecteur.

### N2 — Offline : acquis distingué du restant (constats 12, 15 ; secondaire history)

**Acquis** : catch(null) + persistance (engine.ts:241-251). **Restant, 4 points :**
1. **Succès partiel représenté** : ajouter `stale: { playlists: boolean, likes: boolean }` à `PlayerState` (pas de booléen unique menteur). Chaque fetch échoué → son drapeau true ; succès (même `[]`) → false + persistance. Bandeau `offlineBanner` (clé déjà là) affiché si l'un des deux est true, texte générique « données du cache » (ne prétend pas quelle source).
2. **Trou restant** : `loadPlaylists` (engine.ts:254-258) fait encore `.catch(() => [])` → écrase l'état après un ajout/retrait en réseau défaillant. Corriger : échec ⇒ état conservé + drapeau `stale.playlists`.
3. **Logout : aucune purge** (constat 15, arbitrage produit) : logout vide l'état affiché (engine.ts:229) mais **conserve** les clés `u.<user>.favs/playlists/recent` ⇒ reconnexion hors ligne du même compte retrouve sa bibliothèque. Isolation : clés nommées par compte + `loadLocalUser` recharge par compte (engine.ts:158-171). I3 révisé en conséquence. Pas de champ `history` dans `PlayerState` (constat 12) : l'historique reste la clé localStorage `recent`.
4. **History : comportement actuel conservé et documenté** (secondaire) : persistance seulement si `length > 0` (engine.ts:251) ; un succès vide n'efface pas `recent` (cache d'affichage HomeView, pas une vérité serveur). Exception assumée à la règle « succès vide ⇒ cache vidé », limitée à `recent`.

**CA couvrant les deux cas + le partiel** (§9) : (1) likes vidés via API en ligne → refresh → 0 favori **et** cache `[]` ; (2) mode avion après ≥ 1 session en ligne → 1 842 lignes, cache octet-identique, bandeau ; (3) likes KO / playlists OK (panne ciblée) → favoris du cache, playlists fraîches, drapeaux `{likes:true, playlists:false}`.

### N3 — Lotissement et rehydratation : lequel prime (constat 9)

**Décision : « DOM ≤ 100 » s'applique au chargement à froid** = premier montage d'une route **sans entrée `sessionStorage.sonora.scroll.<clé>`**. Le retour arrière avec entrée sauvegardée est une **exception explicite** : rehydratation `min(batchCount, 10)` lots par paliers de 2 lots/frame (rAF), restauration `scrollTop` quand le lot cible est monté, plafond visible + « Afficher plus ». `useScrollMemory` (hooks.ts:35-41) est étendu pour persister `{scrollTop, batchCount}` (aujourd'hui scrollTop seul). Les deux CA ne portent donc jamais sur le même montage. B5 (profilage post-B) rejoue le protocole sur `#/playlist` 280 titres **et** rehydratation 10 lots : 0 tâche > 100 ms attribuable ; fallback 1 lot/frame sinon.

### N4 — Critères mesurables et test i18n durci (constats 2, 7 ; secondaires ligne/frame)

| Critère | Définition opérationnelle corrigée |
|---|---|
| **≤ 3 interactions** | 1 interaction = tap/clic sur un élément distinct (**y compris « Afficher plus »**, constat 7), ou saisie continue dans un champ (focus inclus), ou Enter de validation. **Le filtre s'applique à la liste COMPLÈTE avant lotissement** (résultats re-lotis depuis 0). Point d'entrée : carte « Titres que tu aimes » ajoutée à LibraryView en A2 (clé `likedView` existante). Scénario figé : tap carte (1) → saisie filtre (2) → tap ligne (3) ; **la cible de test est choisie pour que le filtre renvoie < 100 résultats** (ex. artiste à ~30 favoris) ⇒ aucune interaction « Afficher plus » nécessaire. CA vérifiable. |
| **aléatoire < 2 s** | `performance.now()` entre `pointerup` du bouton et événement `playing` du média ; 3 runs, médiane < 2 s, max < 3 s, réseau local. Fisher-Yates seul < 16 ms (test unitaire, `shuffleArray` déjà exporté engine.ts:769). |
| **tâches > 100 ms** | `PerformanceObserver('longtask')` + `<Profiler>` React autour des vues ; attribution = chevauchement fenêtre longtask × commit `actualDuration > 50 ms`, ou pile DevTools contenant TrackRow/TrackList/render de vue. |
| **frame médian > 25 ms** (secondaire) | Méthode : échantillonneur rAF (boucle `requestAnimationFrame` collectant les deltas pendant un scroll de 10 s), médiane des deltas ; snippet archivé `docs/perf/`. Pas de dépendance. |
| **test i18n** (constat 2) | `lib/i18n.test.ts` vitest : (1) égalité des keysets fr/en/es (un dict ES vide échoue) ; (2) scan des usages : regex `/\btr\([^,]*,\s*'([^']+)'/g` (**couvre `tr(this.state.lang, 'clé')`**, `[^,]*` matche l'expression) + `/\bt\('([^']+)'\)/g` → chaque clé existe ×3 ; (3) **interdiction des littéraux** dans `aria-label=`, `placeholder=`, `title=` (doivent être appels `tr`/`t`) et du motif `lang === 'fr' ?` dans components/views → force la migration du ternaire QueueSheet.tsx:24 vers `tr(lang, 'queue')` (clé existante) ; (4) détecteur de copie EN→ES : clé où `es === en && fr !== en` ⇒ échec sauf **allowlist explicite** de cognats légitimes (Mix, Phonk, Radio…). Honnêteté : (4) est une heuristique à allowlist, pas une preuve de qualité ; C6 = couverture prouvée, qualité = passe VoiceOver. |

### N5 — Gate symétrique (secondaire asymétrie)

**Le même seuil sert dans les deux sens** : jank confirmé ⇔ ≥ 1 tâche > 100 ms attribuable par 60 s de lecture **ou** frame médian > 25 ms (méthode §N4) sur 10 s de scroll. Non-confirmé ⇔ 0 tâche attribuable **et** médiane ≤ 25 ms.
- Appareil réel mi-gamme : décision **définitive** (engage A1a/b, ou les annule).
- Surrogate desktop throttling ×4, viewport 390×844 : décision **provisoire dans les deux sens**, marquée « non vérifié mobile réel », captures `docs/perf/` + `DECISION.md`. Une passe appareil réel **avant release** lève la provisoire (bloquante pour livrer, pas pour coder).
- Tie-break explicite si aucun appareil n'est jamais disponible : engagement par défaut du sélecteur (~40 lignes, fait structurel indépendant du jank : App consomme le snapshot complet à 4 Hz, App.tsx:22 + engine.ts:601-626), marqué non vérifié. **S0 n'est jamais annulé** (constat 5).
- Budget : 4 campagnes (A1.0, post-A1, post-B5, post-C1) → vérification transverse **1,5–2 j**.

### P1 — Schéma `position` (constats 3, 4, 6, 13)

**Migration (constat 6)** : dans `ouvrirBase` (musique.mjs:44-60) : `PRAGMA table_info(playlist_tracks)` → si `position` absente : `ALTER TABLE playlist_tracks ADD COLUMN position INTEGER` **puis backfill une seule fois** (le garde « colonne absente » garantit l'unicité ; aucun backfill aux ouvertures suivantes ⇒ pas de collision d'ordinaux). Backfill par playlist : `ORDER BY added_at ASC, rowid ASC` → 0..n-1. **Densité abandonnée comme invariant** : les DELETE laissent des trous ; append = `COALESCE(MAX(position)+1, 0)` ; ordre d'affichage `ORDER BY (position IS NULL), position` — **NULL en queue, jamais en tête** (garde défensive contre un site d'insertion oublié, constat 6).

**Les 4 sites d'insertion** (constat 4, recensés exhaustivement) écrivent tous `position` :
1. ajout manuel musique.mjs:585 ;
2. `POST /likes` → liste auto musique.mjs:617 ;
3. **`POST /feedback` action like** → liste auto musique.mjs:643 ;
4. resolver musique-resolve.mjs:34.
Test node:test : chaque site insère puis assert `position IS NOT NULL` (un site oublié = test rouge, plus de bug silencieux).

**Ordre source des imports (constat 3, h6 faux — assumé et compensé)** : le resolver résout par tranches `CONC=3` en `Promise.all` (musique-resolve.mjs:8,29-42) ⇒ rowid = ordre d'**achèvement** yt-dlp intra-tranche ; `pending` est vidée après résolution (musique-resolve.mjs:40) ⇒ **l'ordre CSV historique est irrécupérable**. Décision : (a) **assumer** pour l'historique — backfill = ordre approché, permutations locales ≤ 3, documenté dans la note de migration ; l'endpoint reorder (P2) permet la correction manuelle ; (b) **compenser pour le futur** : le resolver résout en parallèle mais **insère dans l'ordre des `pending.id` après `Promise.all`** (collecte des résultats puis insertion séquentielle par tranche) ⇒ imports Spotify futurs = ordre CSV exact. Imports YouTube futurs = ordre source via bulk ordonné (P2).

**Affichage** : `GET /playlists/:id` `ORDER BY (position IS NULL), position` (musique.mjs:558) ; covers déterministes `ORDER BY position` (musique.mjs:534, subsonic.mjs:98,105) ; `playlistComplete` Subsonic : `ORDER BY added_at DESC` → `ORDER BY (position IS NULL), position` (subsonic.mjs:125, seule ligne fonctionnelle touchée). Likes UI inchangés (`added_at DESC`, musique.mjs:598) ; liste auto « Títulos que te gustan » (musique.mjs:234-240) en append chronologique stable pour CarPlay. Inversion unique des playlists legacy (oldest-first) assumée et documentée.

**Durées à l'import (constat 13)** : le payload bulk inclut `duration` (fournie par `/ytplaylist` flat, musique.mjs:174) ; le serveur écrit `track_meta` (`INSERT OR IGNORE`, puis `UPDATE … SET duration` si la valeur existante est 0). Sans cela, le remplissage background est plafonné à 60 ids manquants par GET (musique.mjs:561-562) ⇒ majorité de 0:00. CA : ≥ 90 % des titres importés avec durée non nulle quand `/ytplaylist` la fournit ; export M3U `#EXTINF` non nul pour ces titres.

**Reorder** : `POST /api/mus/playlists/:id/reorder` `{ videoIds }` liste complète, garde `user_id`, 400 si ensemble ≠ existant, transaction `UPDATE position = i`. Atomique, trivial à 280 lignes sur le mini PC.

### P2 — UI et robustesse (constats 8, 11 ; secondaires import/M3U)

**Undo : écriture immédiate + compensation** (constat 8 — le commit différé est abandonné, reload PWA ne démonte pas React) : clic retirer → `DELETE …/tracks/:vid` **immédiat** + retrait optimiste UI. Échec DELETE → rollback UI + toast erreur. Undo (fenêtre 5 s, `UndoToast`) → `POST …/tracks` (re-append) **puis** `POST …/reorder` avec l'ordre complet sauvegardé avant retrait ⇒ la ligne retrouve son index. Échec de compensation → toast erreur, la ligne reste retirée côté serveur (état visible, jamais de divergence silencieuse). Reload : tout est commité, rien à flusher. **C3 dépend donc de P2** (ordre du plan §8).

**Sémaphore yt-dlp (constat 11)** : envelopper **`lancerYtdlp`** (musique.mjs:145-155) et le spawn de **`ytPlaylist`** (musique.mjs:161) dans `ytPrendre()` / `ytRendre()` en **`finally` sur close/error/timeout**. `lancerYtdlp` étant exporté et importé par Subsonic (subsonic.mjs:5, recherche ligne 139), cela couvre `resoudre`, `majMetaAsync`, recherche Subsonic et recos — **plus aucun spawn métadonnées hors pool**. `audio.mjs:90,188` (téléchargements audio) reste **hors pool volontairement** : le faire entrer dans un pool à 2 affamerait la lecture (contrainte dure « ne pas casser le moteur audio »). Deux pools documentés. Affamement import : `ytPlaylist` tient ≤ 1 slot ≤ 30 s (timeout musique.mjs:164) ; les recos gardent ≥ 1 slot ; file FIFO existante (musique.mjs:250-254).

**Import YouTube — compensation et cap** (secondaires) : aperçu (nom, N, avertissement `truncated` — libellé « ≥ 100 titres, liste possiblement tronquée », le faux positif à exactement 100 est assumé) → confirmer → `createPlaylist` → bulk. **Bulk échoué ⇒ `deletePlaylist(id)` best-effort + toast erreur** ; si la suppression échoue aussi, la playlist vide reste visible et supprimable manuellement (dégradation sûre, documentée). Bulk : cap **≤ 100, 400 au-delà** ; videoIds validés `^[A-Za-z0-9_-]{11}$`, aucune résolution yt-dlp par titre. `saveQueueAsPlaylist` (engine.ts:540-547, boucle séquentielle) bascule sur le bulk en P2 (ordre garanti, 1 requête).

**Export M3U/JSON — spec d'échappement** (secondaire) : UTF-8 **sans BOM**, EOL **LF**. `#EXTM3U` puis par titre `#EXTINF:<durée>,<artiste> - <titre>` (seule la **première** virgule sépare la durée ; les virgules du titre sont conservées) ; CR/LF dans titre/artiste remplacés par espace ; ligne suivante = `https://www.youtube.com/watch?v=<id>`. JSON = `JSON.stringify(detail, null, 2)`. Test pur `export.test.ts` : titres à virgule, retour ligne, accents ⇒ fichier conforme, ordre conservé.

**Rename / ConfirmDialog** : rename inline dans PlaylistView → `api.renamePlaylist` (api.ts:125, existant, aucune UI ne l'appelle — vérifié PlaylistView.tsx:55-60) + `loadPlaylists`. `ConfirmDialog` (`role="alertdialog"`, focus Confirmer à l'ouverture, Escape = annuler) remplace les `window.confirm` (PlaylistView.tsx:52, LibraryView). CA manuel focus/Escape (§7, constat 18).

## 4. Alternatives rejetées

| Alternative | Rejet |
|---|---|
| Cache recréé quand `select` change (rév. 3) | Boucle `useSyncExternalStore` avec sélecteur inline (constat 1) ; remplacé par refs + cache unique |
| Inline interdit | Trop fragile à faire respecter ; la recette refs le rend sûr sans discipline |
| Commit différé 5 s pour l'undo | Reload PWA ≠ démontage React ; flush irréalisable (constat 8) ; écriture immédiate + compensation retenue |
| Backfill à chaque `ouvrirBase` | Collisions d'ordinaux sur lignes NULL (constat 6) ; backfill unique à la création de colonne |
| Densité 0..n-1 comme invariant | Faux après DELETE sans renumérotage (constat 6) ; trous + ordre croissant suffisent |
| Backfill via `pending` pour l'historique | Table vidée après résolution (musique-resolve.mjs:40) ; irrécupérable, assumé (constat 3) |
| `ORDER BY position` seul | NULL en tête = bug silencieux (constat 6) ; `(position IS NULL), position` |
| Pool yt-dlp unique incluant audio.mjs | Affame la lecture ; contraire à la contrainte dure ; deux pools |
| jsdom / Testing Library | Dépendance interdite (C1) ; tests purs + 5 CA manuels chiffrés (§7) |
| Purge des clés au logout | Détruit la reconnexion hors ligne (constat 15) ; aucune purge automatique |
| Booléen `libraryStale` unique | Mentirait sur succès partiel (constat 12) ; drapeaux par source |
| Map de handlers par id, virtualisation, rangs fractionnaires, 100×POST import, IntersectionObserver | Maintenus rejetés de la rév. 3 (motivations inchangées) |

## 5. Interfaces et flux de données

```ts
// lib/selector.ts (nouveau, pur)
createSelectorCache<S,T>(): { read(source: S, select: (s:S)=>T, eq: (a:T,b:T)=>boolean): T }
shallowEqual(a: unknown, b: unknown): boolean
// audio/usePlayer.ts
usePlayerSelector<T>(select: (s: PlayerState) => T, eq?): T   // getSnapshot stable, refs
type UiState = Omit<PlayerState,'currentTime'|'duration'|'volume'>  // + stale: {playlists,likes}
// components/TrackList.tsx (nouveau — S0)
interface TrackListProps { tracks: Track[]; lang: Lang; likedIds: Set<string>; currentId: string|null;
  removable?: boolean; menu?: boolean; onRemove?:(t:Track,i:number)=>void; onMenu?:(t:Track)=>void;
  onBatchChange?:(n:number)=>void }   // data-index ABSOLU ; lots 100 ; « Afficher plus »
// lib/api.ts (ajouts)
ytPlaylist(id)            // ex-privé api.ts:83 → public, + truncated
bulkAddToPlaylist(id, tracks: {id,title,artist,duration}[])
reorderPlaylist(id, videoIds: string[])
// lib/export.ts (nouveau) : toM3U / toJSON / download — spec §P2
```

**Serveur** : `POST …/tracks/bulk` (≤100, transaction, append ordonné, `track_meta` durées, garde user) ; `POST …/reorder` (ensemble égal, transaction) ; `GET …/:id` ordre §P1. **Flux undo** : DELETE immédiat → UndoToast 5 s → Annuler = POST tracks + POST reorder (ordre sauvegardé). **Flux import** : `/ytplaylist` (pool ≤2) → aperçu → POST playlists → POST bulk → échec bulk = DELETE playlist best-effort.

## 6. Risques et modes de défaillance

| # | Risque | Mitigation |
|---|---|---|
| R-a | Sélecteur inline → boucle | Recette refs (§N1) + test (b) ; `getSnapshot` jamais recréé |
| R-b | Site d'insertion `position` oublié | NULL en queue + test node:test sur les 4 sites |
| R-c | Ordre Spotify historique faux | Assumé (permutations ≤3), documenté ; reorder manuel ; resolver corrigé pour le futur |
| R-d | Compensation undo échoue | Toast erreur explicite ; serveur = vérité ; jamais de divergence silencieuse |
| R-e | Import : playlist vide résiduelle | Delete best-effort ; sinon visible/supprimable ; documenté |
| R-f | `/ytplaylist` timeout 30 s | Busy + erreur traduite + réessayer ; rien créé avant aperçu ; recos gardent ≥1 slot |
| R-g | Rehydratation > 100 ms | B5 mesure ; fallback 1 lot/frame ; plafond 10 lots visible |
| R-h | Gate franchi sur surrogate seulement | Décision provisoire **dans les deux sens** + passe réel avant release |
| R-i | Régression Subsonic | Diff = 1 ligne d'ordre + covers ; smoke 14/14 + test parité d'ordre |
| R-j | `loadPlaylists` écrase sur échec | Garde §N2.2 ; drapeau `stale.playlists` |
| R-k | Détecteur copie EN→ES : faux positifs | Allowlist explicite de cognats ; heuristique assumée, pas une preuve |

## 7. Stratégie de test (constat 18 : pas de DOM gratuit)

**Automatisé pur (vitest, devDep existante)** : `selector.test.ts` (I2 + inline sûr) ; `i18n.test.ts` (§N4, 4 règles) ; `export.test.ts` (échappement/ordre) ; `normalize.test.ts`, `time.test.ts` ; `shuffleArray` (< 16 ms, non biaisé statistiquement).
**Automatisé serveur (node:test, harnais tests/api.test.mjs:41-53)** : `playlists.test.mjs` — migration unique/idempotente (2 ouvertures ⇒ même ordre) ; **4 sites d'insertion ⇒ position non-null** ; NULL-last ; trous après DELETE ; reorder valide/400/404 cross-compte ; bulk cap 100/400 au-delà, doublons `INSERT OR IGNORE` (position du doublon inchangée), durées → `track_meta` ; resolver : tranche simulée à achèvements désordonnés ⇒ insertion dans l'ordre des id ; parité d'ordre `GET mus` ↔ `getPlaylist` Subsonic ; isolation A/B.
**CA manuels chiffrés (5 points DOM non testables sans dépendance)** :
1. **Mapping index** : #/liked, 2 lots, cliquer ligne 150 → mini-player = titre 150 (titre vérifié à l'écran).
2. **Undo compensation** : retirer la ligne 5 d'une playlist 20 → Annuler < 5 s → ligne 5 revenue à l'index 5 après reload.
3. **Rehydratation rAF** : retour sur #/liked après 10 lots → 0 longtask > 100 ms (capture Performance).
4. **ConfirmDialog** : ouverture → focus sur Confirmer (anneau visible) ; Escape → fermé sans action ; Tab cycle dans le dialog.
5. **Langue réactive** : basculer FR→ES sur #/liked → aria-labels des lignes en ES immédiatement (VoiceOver).
**Profiling** : 4 campagnes §N5 ; **smoke** : `total=14, failed=0` ; QA api.py 54/54 ; `npm run check`, `npm test`, typecheck + vitest frontend à chaque lot.

## 8. Plan d'implémentation ordonné

| Étape | Fichiers | CA |
|---|---|---|
| **A1.0** Gate (bloquant) | aucun ; `docs/perf/` | Décision §N5 consignée (seuil symétrique, provisoire si surrogate) |
| **S0** TrackList structurel (**toujours**, constat 5) | `TrackRow.tsx` (memo, prop `lang`, data-action, suppression lecture snapshot ligne 20), `components/TrackList.tsx` ✚ (délégation index absolu, lots 100), `lib/time.ts` ✚ (4 copies), `LibraryView/PlaylistView/ArtistView/SearchView.tsx`, `app.css` (rise 1er lot) | DOM ≤ 100 à froid (I6) ; CA manuels 1 et 5 ; clavier Enter OK ; typecheck |
| **A1a** Sélecteur pur *(conditionnel gate)* | `lib/selector.ts` ✚ + test, `usePlayer.ts` | Tests §N1 (a)-(d) verts |
| **A1b** Abonnements *(conditionnel)* | `App.tsx:22` + **les 11 consommateurs** (§N1, constat 17) | 60 s lecture : renders App ≤ 2/min ; progression fluide ; 0 longtask attribuable |
| **A2** Hiérarchie + carte likés + route | `LibraryView.tsx` (Playlists → carte « Titres que tu aimes » → aperçu 20 → Téléchargements → compte), `hooks.ts` (+route liked, `useScrollMemory` étendu `{scrollTop,batchCount}`), `App.tsx` | 8 playlists sans scroll 390×844 ; carte → #/liked en 1 tap |
| **A3** LikedView | `views/LikedView.tsx` ✚, `lib/normalize.ts` ✚ | Filtre sur liste complète avant lots ; ≤ 3 interactions (§N4) ; aléatoire < 2 s ; filtre < 16 ms/frappe |
| **A4** Offline restant (§N2) | `engine.ts` (`stale` ×2, garde `loadPlaylists:255`, logout sans purge), `LibraryView/SearchView` (bandeau + section locale), `i18n` clés déjà là | 3 CA §N2 (vide légitime / avion / partiel) |
| **B1** Rehydratation bornée | `TrackList.tsx` (rAF 2 lots/frame), `hooks.ts` | Retour : ≤ 1000 lignes, plafond visible, ±1 lot ; CA manuel 3 |
| **B2** i18n durci | `lib/i18n.test.ts` ✚, `QueueSheet.tsx:24` → `tr(lang,'queue')`, littéraux restants | Test rouge si clé ES retirée exprès ; 0 ternaire `lang==='fr'?` hors data trilingue |
| **B3** États recherche | `SearchView.tsx:52,82-89,118` (erreur ≠ vide, busy load-more) | Piped coupé → erreur + réessayer ; *(seek/volume/deps lang : acquis)* |
| **B5** Profilage post-B (bloquant) | captures | 0 longtask attribuable sur #/playlist 280 + rehydratation |
| **P1** Position serveur | `musique.mjs:44-60` (migration+backfill unique), `:534,558,585,617,643` (ordre+4 sites), `musique-resolve.mjs:29-42` (insertion ordonnée), `subsonic.mjs:98,105,125`, `tests/playlists.test.mjs` ✚ | Tests §7 verts ; smoke 14/14 ; QA 54/54 |
| **P2** Bulk + reorder + pool | `musique.mjs` (2 endpoints, `lancerYtdlp:145` + `ytPlaylist:161` sous sémaphore finally), `api.ts`, `engine.ts:540-547` (bulk) | Tests bulk/reorder/isolation/pool ; recos fonctionnent pendant un import |
| **C1** AddSheet généralisé + ⋯ | `AddSheet.tsx`, `App.tsx:128-132`, `TrackList.tsx` (menu), `components/ActionSheet.tsx` ✚ ; **rejouer profilage** | Ajouter sans lire ; captures post-C1 |
| **C2** playNext/enqueue | `engine.ts` (pattern `startHls(qi)` de `moveQueue:508`), `QueueSheet.tsx` | « Lire ensuite » respecté direct + HLS iOS ; *(shuffle : acquis)* |
| **C3** Rename/retrait/undo/dialog *(après P2)* | `PlaylistView.tsx`, `ConfirmDialog.tsx` ✚, `UndoToast.tsx` ✚, `engine.ts`, `LibraryView.tsx` | CA manuel 2 + 4 ; persiste après reload ; plus de `window.confirm` |
| **P3** Import YouTube | `ImportSheet.tsx` ✚, `LibraryView.tsx`, `engine.ts`, `api.ts` | Ordre source après reload + CarPlay ; ≥ 90 % durées non nulles ; compensation échec bulk |
| **P4** Export | `lib/export.ts` ✚ + test, `PlaylistView.tsx` | M3U/JSON ordre écran ; échappement testé |
| **V** Transverse 1,5–2 j | aucun | §9 sur 2 comptes × 3 langues ; diff serveur limité `musique.mjs/subsonic.mjs/musique-resolve.mjs` ; package.json frontend inchangé |

Effort : S0 1–2 j, A1 1–2 j (conditionnel), A2–A4 3–4 j, B 2–3 j, P1–P2 1,5–2 j, C 2–3 j, P3–P4 1–1,5 j, V 1,5–2 j ⇒ **13–19 j**.

## 9. Critères d'acceptation observables

| Propriété | État observable | Deux exécutions | Attendu |
|---|---|---|---|
| Stabilité sélecteur | Référence `read` | (1) même source ×2 ; (2) 100 sélecteurs inline frais, patch currentTime | (1) `Object.is` vrai ; (2) même référence à chaque appel ; patch playing ⇒ nouvelle |
| Renders App | Profiler, 60 s sans interaction | 2 comptes | ≤ 2/min chacun |
| DOM à froid vs retour | `querySelectorAll('.track').length` (I6) | (1) cold #/liked ; (2) retour après 10 lots | (1) ≤ 100 ; (2) ≤ 1000, plafond visible — deux montages distincts (constat 9) |
| Offline 3 cas (§N2) | UI + `sonora.u.<user>.favs` + drapeaux | (1) likes vidés API puis refresh ; (2) avion ; (3) likes KO/playlists OK | (1) 0 + cache `[]` ; (2) 1842 + cache identique + bandeau ; (3) likes cache, playlists fraîches, `{likes:true,playlists:false}` |
| Reconnexion hors ligne (constat 15) | localStorage après logout | (1) logout ; (2) re-login même compte en avion | (1) clés `u.<user>.*` intactes ; (2) bibliothèque retrouvée |
| Isolation | API | B lit / reorder la playlist de A | 404 ×2 ; smoke 14/14 |
| Ordre source | videoIds | (1) import YouTube 100 : écran/reload/Subsonic ; (2) migration legacy ×2 | (1) ordre identique ×3 ; (2) idempotent ; historique Spotify = ordre approché documenté |
| position non-null (constat 4) | SQL après chaque site | 4 sites d'insertion | `position IS NOT NULL` ×4 ; NULL éventuel trié en queue |
| ≤ 3 interactions | Compteur §N4, cible < 100 résultats filtrés | FR puis ES | ≤ 3, lecture lancée, 0 « Afficher plus » requis |
| Undo (constat 8) | Index après reload | (1) retirer+Annuler ; (2) retirer+attendre+reload | (1) index restauré ; (2) retrait persistant ; échec réseau ⇒ toast, pas de divergence |
| i18n (constat 2) | `vitest run` | (1) dépôt complet ; (2) clé ES retirée / valeur EN recopiée en ES | (1) vert ; (2) rouge dans les deux sous-cas (hors allowlist) |
| Pool yt-dlp (constat 11) | Processus yt-dlp actifs | import pendant recos | ≤ 2 spawns métadonnées ; audio.mjs inchangé ; recos aboutissent |
| Gate (N5) | `DECISION.md` | réel / surrogate | même seuil ; surrogate = provisoire ×2 sens + passe réel avant release |
| Aucune dépendance | `git diff frontend/package.json` | après chaque lot | vide |

---

**Synthèse des corrections.** 1 : cache unique + refs, `getSnapshot` jamais recréé, inline sûr prouvé par test. 2 : regex `[^,]*`, interdiction littéraux/ternaires, détecteur copie EN→ES à allowlist, C6 honnête. 3 : ordre historique irrécupérable assumé (permutations ≤3), resolver corrigé pour le futur. 4 : 4 sites recensés + test non-null + NULL-last. 5 : S0 structurel toujours exécuté, gate n'annule que A1a/b. 6 : backfill unique, densité abandonnée, trous + ordre croissant. 7 : « Afficher plus » compte, filtre avant lots, carte likés en A2, cible < 100. 8 : écriture immédiate + compensation reorder, C3 après P2. 9 : DOM ≤ 100 = cold load, retour = exception ≤ 1000. 10 : prop `lang` réactive. 11 : `lancerYtdlp` + `ytPlaylist` sous sémaphore finally (couvre Subsonic via import), audio.mjs hors pool volontaire. 12 : acquis distingué, drapeaux par source, trou `loadPlaylists` corrigé, pas de champ history. 13 : duration dans bulk → track_meta. 14 : smoke = 14, `total=14 failed=0`, QA 54/54. 15 : aucune purge au logout, reconnexion hors ligne préservée. 16 : index absolu + contrôle croisé id. 17 : 11 consommateurs listés. 18 : tests purs + 5 CA manuels chiffrés, « gratuit » corrigé. Secondaires traités : gate symétrique + méthode rAF, « ligne » = `.track`, reorder **créé** par P2, ancres re-vérifiées post lots 0+1 (SHA indisponible, dit), compensation import + cap 100/400, M3U UTF-8 sans BOM/LF/échappement, history `if(length)` conservé et documenté.
