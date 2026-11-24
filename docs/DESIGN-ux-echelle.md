# Design UX — Sonora v2.0.3 : passer à l'échelle des usages réels (rév. 2)

> Livrable de conception (lecture seule — aucun fichier modifié, aucun code écrit par l'Elephant).
> Révision 2 : corrige les 7 constats de la revue sans contexte. Les constats partiellement faux sont signalés comme tels, avec preuve.

## 0. Constats de la revue → corrections appliquées

| # | Constat | Verdict | Correction |
|---|---|---|---|
| 1 | A4 promet l'offline alors que les favoris viennent d'un fetch serveur | **Partiellement fondé** — le mécanisme existe (favs en localStorage, engine.ts:158,269) mais un défaut réel l'invalide : refreshLibrary écrase le cache avec [] quand le fetch échoue (engine.ts:231-234) | Source hors ligne explicitée (cache localStorage, précondition h4) ; garde ajoutée dans refreshLibrary ; §9 renommé « Bibliothèque consultable hors ligne (métadonnées) » |
| 2 | Priorité de A justifiée par « impact maximal prouvé » alors que F2/h1 déclarent le jank non mesuré | **Accepté** | §5 refondé sur F1+F3 (faits de code) ; F2 rétrogradée en hypothèse ; étape bloquante A1.0 : profilage de référence avant toute optimisation |
| 3 | Remède optionnel (usePlayerSelector) pour un critère contractuel ; memo seule ineffective si le parent re-rend | **Accepté** — vérifié : App.tsx:22 consomme le snapshot complet, props recréées (App.tsx:92, LibraryView.tsx:146) | Le sélecteur devient contractuel ; App abonné à une tranche excluant currentTime/duration ; MiniPlayer/PlayerSheet/DesktopPlayer s'abonnent à la progression ; callbacks hissés ; CA : renders App ≤ 2/min en lecture |
| 4 | Contradiction O(n) : likes.some() « Fort » vs « includes < 1 ms » ; la normalisation invalide le « < 1 ms » | **Partiellement faux** — les ordres diffèrent : O(n²) par render × ~4 Hz vs O(n) par frappe débouncée | §3-F2 requalifié « Fort structurel, ampleur non mesurée » ; « < 1 ms » supprimé, remplacé par un budget mesuré (< 16 ms/frappe) ; chaînes pré-normalisées via useMemo |
| 5 | Conflit A/B : lots de 100 vs « DOM < 100 lignes » ; scroll non restaurable au-delà du premier lot | **Accepté** | « DOM initial ≤ 100 lignes » ; interface A→B : A3 persiste {scrollTop, batchCount} ; B1 réhydrate min(batchCount, 10) lots ; plafond visible, jamais de saut silencieux |
| 6 | « A prépare C (AddSheet généralisé) » faux — c'est C1 ; le menu ⋯ réintroduit R2 sans re-profilage | **Partiellement accepté** — la préparation TrackRow mémoïsé est réelle, l'attribution AddSheet à A était fausse | Mention AddSheet retirée de A ; handler ⋯ unique stable ; CA C1 ajoute une porte de régression (rejouer le profilage A1) |
| 7 | (tronqué) effort de A et budget de vérification sous-estimés | **Accepté (reconstruction plausible, hypothèse)** | A 3-5 j → 5-8 j ; B 2-3 → 3-4 j ; C 3-4 → 3-5 j ; vérification transverse budgétée 0,5-1 j ; hypothèse matériel h5 |

## 1. Objectif / non-objectifs

**Objectif.** Rendre l'expérience mobile fluide et efficace *avec les volumes réels* : 1 842 favoris, 8 listes (~280 titres), en PWA standalone, avec lecture en cours pendant la navigation.

**Non-objectifs.**
- Pas de travail fiabilité/robustesse (lecture, HLS, watchdog, offline audio : acquis, docs/ROADMAP.md v1.16). La consultation hors ligne des **métadonnées** est dans le périmètre de A4 (elle existe déjà, il s'agit de la rendre fiable). La lecture audio hors ligne reste limitée aux Téléchargements.
- Ne pas toucher au gateway Subsonic/CarPlay ni aux endpoints serveur — aucun changement backend nécessaire.
- i18n FR/EN/ES : toute nouvelle chaîne dans les trois dictionnaires.
- Aucune dépendance ajoutée. Mobile-first ; le desktop ne doit pas régresser.

## 2. Cartographie de l'existant

### Navigation
- 5 routes hash : listen, search, library, playlist/:id, artist/:id (hooks.ts:9-18).
- 3 onglets bas (App.tsx:104-110), mini-player fixe (App.tsx:102, app.css:265-298), bas de page réservé 232 px (app.css:778).
- 3 sheets : lecteur, file, ajout-playlist — ouvertes seulement depuis le lecteur/mini-player (App.tsx:112-129).
- PWA standalone (manifest.webmanifest:7) : pas de retour navigateur, aucun retour in-app, aucune restauration de scroll (hooks.ts:20-28).

### Écrans
| Écran | Contenu | Densité |
|---|---|---|
| Écouter (HomeView) | hero, chips, Tes Mix, Pour toi, Récents, playlists | carrousels, raisonnable |
| Rechercher (SearchView) | saisie, 4 filtres Piped, load-more | 100 % distant |
| Bibliothèque (LibraryView) | compte, réglages, Téléchargements, tous les Favoris, Playlists | 1 842 lignes d'un bloc (LibraryView.tsx:143-147) |
| Playlist (PlaylistView) | titre, Lecture/Aléatoire/Supprimer, liste | ~280 lignes |
| Artiste (ArtistView) | hero + pistes | pas de lecture, pas de pagination |

### États et données
- Chargement : global minimal (App.tsx:56-58), squelettes sur Home, « Chargement… » ailleurs (PlaylistView.tsx:37).
- Vide : traduits, sauf « File vide » en dur (QueueSheet.tsx:38).
- Erreur : « Erreur. » générique (PlaylistView.tsx:38) ; recherche confond erreur réseau et zéro résultat (SearchView.tsx:52→118) ; authError/sessionExpired jamais affichés (engine.ts:223, i18n.ts:29).
- **Cycle des favoris (vérifié)** : boot depuis localStorage (engine.ts:158), persistance dans toggleLike (engine.ts:267-269), mais refreshLibrary écrase avec [] si le fetch échoue (engine.ts:231-234) → cache vidé hors ligne. playlists n'a aucune persistance locale.
- Lecture : timeupdate ~4 Hz patche le store global (engine.ts:539-563), consommé à la racine (App.tsx:22 via usePlayer.ts:4-6) → tout l'arbre re-rend. Seuls MiniPlayer.tsx:13, PlayerSheet.tsx:29,47-48, DesktopPlayer.tsx:24,43,46 lisent currentTime/duration (grep vérifié).

## 3. Frictions constatées

| # | Friction | Preuves | Impact | Coût |
|---|---|---|---|---|
| F1 | Bibliothèque inutilisable à l'échelle : 1 842 favoris en liste plate, sans filtre/tri/Lecture ; playlists sous 1 842 lignes (~125 000 px) | LibraryView.tsx:127-179,143-147 ; musique.mjs:564 ; app.css:208-215 | Très fort — structurel, vérifié | Moyen |
| F2 | Jank : chaque timeupdate re-rend l'arbre ; likes.some() par ligne = O(n²) par render ~4 Hz ; animation rise par ligne | App.tsx:22, engine.ts:556-562, LibraryView.tsx:132,146, app.css:211 | Fort structurel ; ampleur non mesurée → A1.0 | Moyen |
| F3 | Impossible de retrouver un titre aimé : recherche 100 % Piped, aucun filtre local | SearchView.tsx:46 | Fort — absence vérifiée | Faible |
| F4 | Playlists : remove/rename existent côté API, aucune UI ne les appelle ; ajout seulement pour le titre en cours | api.ts:121-127, musique.mjs:531,555-559, PlaylistView.tsx:52-55, App.tsx:125-129 | Fort | Faible |
| F5 | Culs-de-sac : aucun retour depuis playlist/artiste ; scroll perdu | manifest.webmanifest:7, PlaylistView.tsx:40-50, hooks.ts:20-28 | Moyen-fort | Faible |
| F6 | Aucune action de file : pas de « lire ensuite » ; file réordonnable ±1 cran | engine.ts:463-495, QueueSheet.tsx:32-34 | Moyen | Moyen |
| F7 | Fuites i18n : toasts et aria-labels FR en dur, session expirée silencieuse | engine.ts:258,274,285,323,336,521,523,534,599,603,608,624 ; TrackRow.tsx:27,30 ; MiniPlayer.tsx:21,25 ; PlayerSheet.tsx:44,53,57 ; QueueSheet.tsx:18,32-38 | Moyen | Faible |
| F8 | Aléatoire biaisé (Math.random()-0.5) et irréversible | engine.ts:499, PlaylistView.tsx:33 | Moyen | Faible |
| F9 | Recherche : erreur réseau rendue comme « aucun résultat » ; load-more sans busy | SearchView.tsx:52,82-89,118 | Faible-moyen | Faible |
| F10 | Lecteur mobile : slider volume inutile sur iOS ; seek à chaque onChange | PlayerSheet.tsx:62-66,44-45 | Faible | Faible |
| F11 | Re-fetch réseau au changement de langue | PlaylistView.tsx:29, ArtistView.tsx:36 | Faible | Trivial |

## 4. Trois chantiers

### Chantier A — La bibliothèque à l'échelle (F1+F2+F3)
1. **A1.0 Mesure d'abord (bloquant)** : profilage de référence (mobile mi-gamme + throttling ×4), 60 s de lecture sur #/library ; capturer tâches longues et renders. Si le jank n'est pas confirmé, le sous-chantier perf se réduit à memo + props stables, sélecteur différé, décision consignée.
2. Inverser la hiérarchie : Playlists → aperçu Favoris (20 + « Tout voir ») → Téléchargements → compte/réglages.
3. Vue « Titres que tu aimes » (#/liked) : compteur, Lecture/Aléatoire (Fisher-Yates), filtre accent-insensible sur chaînes pré-normalisées (useMemo, pas par frappe), tri récent/A-Z, lots de 100.
4. **Socle perf contractuel** : usePlayerSelector (useSyncExternalStore + cache à égalité) ; App abonné à une tranche excluant currentTime/duration ; MiniPlayer/PlayerSheet/DesktopPlayer abonnés à la progression ; React.memo(TrackRow) + props stables (callbacks hissés, durationLabel mutualisé dans lib/time.ts, likedIds en Set). Le sélecteur n'est **pas** optionnel : sans lui, memo est ineffective.
5. Recherche locale : section « Dans ta bibliothèque » en tête de SearchView, source state.likes alimenté par le cache localStorage (h4 : ≥ 1 session en ligne préalable). Correctif requis : refreshLibrary ne patche plus un fetch échoué (garde ~3 lignes).

Effort **5-8 j**. Risque faible-moyen : A ne touche engine.ts que sur refreshLibrary (données) ; ni file, ni lecture, ni serveur.

### Chantier B — Navigation & finitions mobile (F5+F7+F9+F10+F11)
1. Retour ‹ + restauration du scroll **bornée** : persistance {scrollTop, batchCount} par route (sessionStorage, interface posée en A3) ; réhydrater min(batchCount, 10) lots puis restaurer ; au-delà, position plafonnée + « Afficher plus », jamais de saut silencieux.
2. i18n exhaustif : toasts via tr(), aria-labels traduits, bandeau session expirée.
3. États honnêtes : erreur ≠ vide ; busy sur load-more ; deps lang retirées.
4. Lecteur mobile : masquer le volume iOS ; seek au relâchement ; sheet fermable par glissement (optionnel).

Effort **3-4 j**. Risque faible.

### Chantier C — Playlists et file (F4+F6+F8)
1. Menu ⋯ par ligne : « Ajouter à une playlist » (**AddSheet généralisé — fait en C1, pas en A**), « Lire ensuite », « Ajouter à la file ». Handler unique et stable (useCallback paramétré par track) ; porte de régression : rejouer le profilage A1 après C1.
2. Engine : playNextInQueue / enqueue sur le pattern startHls(qi) de moveQueue.
3. Entretien : onRemove par ligne + renommer.
4. Shuffle Fisher-Yates + restauration de l'ordre.

Effort **3-5 j**. Risque moyen (seul chantier touchant l'engine de file).

## 5. Décision et ordre

**A d'abord, puis B, puis C.**
1. Impact **structurel prouvé dans le code** : F1 (1 842 lignes d'un bloc) et F3 (aucun filtre local) sont des faits, pas des hypothèses ; dégradation continue. F2 reste une hypothèse : elle ne fonde pas la priorité, A1.0 la mesure avant d'engager le remède.
2. Risque contenu : A ne touche ni la file ni la lecture, ni le serveur ; seule retouche engine : la garde refreshLibrary. Pas d'E2E automatisés dans le projet.
3. A prépare C **uniquement** par le socle de rendu (TrackRow mémoïsé, discipline de props) que C1 devra respecter. La généralisation d'AddSheet est en C1, pas en A.
B avant C : peu coûteux, assainit l'i18n avant que C n'ajoute des chaînes.

## 6. Alternatives écartées
- Virtualisation (react-window…) : dépendance interdite ; lots de 100 + mémoïsation + sélecteur suffisent (à confirmer par A1.0 et la porte C1).
- Refonte du store : le sélecteur minimal est retenu et contractuel ; une refonte complète reste écartée.
- Progression dans un second store : touche le cœur media de l'engine pour un gain équivalent côté abonnés.
- Drag & drop des playlists : aucun endpoint d'ordre (musique.mjs:525).
- Index IndexedDB pour la recherche : écarté sur la **nature** du coût, pas sur un chiffre non mesuré. Filtre O(n) par frappe débouncée (300 ms) sur chaînes pré-normalisées ; F2 est d'un autre ordre (O(n²) × 4 Hz). Budget opposable : < 16 ms/frappe, mesuré (CA A4) ; si la mesure dément, l'index redevient une option.
- Handlers mediaSession seekto : adjacent au domaine robustesse, friction non démontrée.
- Refonte Home / tout en un chantier : rejetés.

## 7. Risques
- R1 réorientation → ne rien supprimer, seulement réordonner.
- R2 mémoïsation ratée si props instables → critère profilé ; C1 rejoue A1.
- R3 geste de sheet vs seek → zone limitée à la poignée.
- R4 insertion de file en HLS actif → suivre startHls(qi), revalider iOS.
- R5 langue oubliée → tr retombe sur l'EN ; revue des 3 dictionnaires.
- R6 pas d'E2E → critères manuels sur les vrais comptes, budget 0,5-1 j explicite.
- R7 (nouveau) cache hors ligne périmé : un like fait sur un autre appareil n'apparaît qu'au refresh en ligne → assumé et documenté.
- R8 (nouveau) useSyncExternalStore mal caché → boucle de rendus ou tearing. Invariant : getSnapshot stable entre notifications ; sélecteurs stables ; recette dédiée dans le CA A1.
- R9 (nouveau) garde refreshLibrary : une liste serveur légitimement vide ne videra plus le cache → trade-off assumé.
Hypothèses : h1 jank non mesuré (A1.0) ; h2 les favoris sont la bibliothèque principale ; h3 fuites i18n gênantes pour au moins un usage EN/ES ; h4 ≥ 1 session en ligne préalable sur l'appareil ; h5 appareil mi-gamme disponible, sinon throttling ×4 desktop et résultat marqué « non vérifié sur mobile réel ».

## 8. Plan d'implémentation

### A
- **A1.0 Baseline (bloquant)** — aucun fichier. Profilage ×4, 60 s sur #/library ; capturer tâches > 100 ms et renders. CA : captures archivées (docs/perf/), décision consignée sur l'ampleur du socle perf.
- **A1 Socle perf contractuel** — usePlayer.ts (usePlayerSelector), App.tsx:22 (tranche sans currentTime/duration, callbacks hissés), MiniPlayer.tsx, PlayerSheet.tsx, DesktopPlayer.tsx (abonnement progression), TrackRow.tsx (memo), lib/time.ts (formatTime mutualisé), vues (likedIds Set, props stables), app.css:211 (rise limité au premier lot). CA : 60 s de lecture, renders App ≤ 2 hors interaction, aucune tâche > 100 ms liée aux lignes, captures comparées à A1.0 ; progression fluide ; invariant R8 vérifié.
- **A2 Réordonner + route #/liked** — LibraryView.tsx, hooks.ts:9-18, App.tsx, i18n.ts ×3. CA : 8 playlists visibles sans scroll sur 390×844 ; DOM initial ≤ 100 lignes.
- **A3 Vue « Titres que tu aimes »** — LikedView.tsx (nouveau), lib/normalize.ts (nouveau), persistance {scrollTop, batchCount}. CA : DOM initial ≤ 100 lignes ; titre en ≤ 3 interactions ; aléatoire < 2 s ; 3 langues.
- **A4 Recherche locale + garde offline** — SearchView.tsx, engine.ts:227-236 (garde), i18n.ts. CA : titre aimé avant tout résultat réseau ; mode avion après h4 : 1 842 métadonnées du cache, cache non vidé ; filtre < 16 ms/frappe mesuré ; compte jamais connecté → état vide traduit.

### B
- **B1 Retour ‹ + scroll borné** — PlaylistView, ArtistView, LikedView, LibraryView (sessionStorage), hooks.ts (helper). CA : scroll restauré ±1 lot jusqu'à 1 000 lignes ; au-delà plafond visible ; lien direct → #/library.
- **B2 i18n toasts/aria/session** — engine.ts, TrackRow.tsx, MiniPlayer.tsx, PlayerSheet.tsx, QueueSheet.tsx, App.tsx, i18n.ts. CA : en ES zéro chaîne FR ; bandeau session expirée visible.
- **B3 États recherche, deps lang, volume iOS, seek au relâchement** — SearchView, PlaylistView:29, ArtistView:36, PlayerSheet:44-45,62-66. CA : Piped coupé → erreur + réessayer ; changer de langue ne fetch rien ; un seul saut au drag.
- **B4 (optionnel) Fermeture des sheets par glissement** — PlayerSheet, QueueSheet, AddSheet, app.css. CA : glisser la poignée ferme ; le drag de seek ne ferme pas.

### C
- **C1 AddSheet généralisé + menu ⋯** — AddSheet.tsx (track arbitraire), App.tsx:125-129, TrackRow.tsx (onMenu stable), vues, i18n.ts. CA : ajouter n'importe quelle ligne sans la lire ; porte de régression : profilage A1 rejoué, captures archivées.
- **C2 playNextInQueue / enqueue + shuffle** — engine.ts:463-495,499, QueueSheet.tsx, PlaylistView.tsx:33. CA : « lire ensuite » respecté et visible en file, direct et HLS iOS.
- **C3 Retirer / renommer** — PlaylistView.tsx, api.ts:121-127, i18n.ts. CA : persiste après reload ; nom à jour partout ; pas de régression sur la suppression de liste.

**Vérification finale transverse (0,5-1 j)** : parcours complet sur les 2 comptes, 3 langues, fermeture/réouverture PWA, scénario avion (h4), git diff --stat server/ vide. Total révisé : **11-17 j + 0,5-1 j** (contre 8-12 j non budgétés en rév. 1).

## 9. Critères d'acceptation observables
| Propriété | Observation |
|---|---|
| Bibliothèque utilisable à 1 842 favoris | playlists sans scroll ; titre en ≤ 3 interactions ; DOM initial ≤ 100 lignes |
| Plus de jank attribuable aux listes | baseline A1.0 ; après A1 : aucune tâche > 100 ms, renders App ≤ 2/min ; rejoué après C1 |
| Bibliothèque consultable hors ligne (métadonnées) | mode avion après h4 : recherche locale et filtre favoris sur le cache localStorage ; audio hors ligne limité aux Téléchargements |
| Navigation sans cul-de-sac | tout écran profond a un retour ; scroll restauré ±1 lot, plafond 10 lots assumé et visible |
| i18n complet | passe VoiceOver FR/EN/ES, zéro chaîne hors langue |
| Playlists entretenables | cycle ajout/retrait/renommage persistant après reload |
| Session d'écoute constructible | « lire ensuite » respecté en direct et HLS iOS |
| Subsonic/CarPlay non dégradé | diff serveur vide ; smoke test inchangé |
| Aucune dépendance ajoutée | frontend/package.json inchangé |

**Synthèse** : F1 et F3 sont des faits de code et fondent la priorité de A ; F2 reste une hypothèse que A1.0 mesure avant d'engager le remède, désormais contractuel (sélecteur + props stables, pas un memo seul). B suit sur l'interface de scroll posée par A3 ; C ferme la marche et doit prouver, profilage à l'appui, qu'il n'a pas défait le socle de rendu.


## 10. Risques connus non résolus (revue 3, sans contexte)

Le critique de la révision 2 a rendu NEEDS-WORK avec 5 constats. Aucun n'invalide le design, mais chacun doit être tranché **avant** l'étape concernée. Ils sont consignés ici plutôt que corrigés : le processus s'arrête à deux révisions.

| # | Constat | À trancher avant |
|---|---|---|
| N1 | Contradiction : A1.0 autorise un « sélecteur différé » alors que A1 le déclare non optionnel. Une tranche stable de useSyncExternalStore exige soit useSyncExternalStoreWithSelector (une dépendance, interdite), soit un cache versionné maison que R8 nomme sans décrire. Le « handler unique stable paramétré par track » est contradictoire : paramétré = 1 842 closures recréées. | A1 |
| N2 | Le périmètre hors ligne est à la fois déclaré acquis, corrigé et hors périmètre. La garde refreshLibrary (R9) introduit une régression de justesse (une liste serveur légitimement vide ne vide plus le cache) qu'aucun critère ne couvre. | A4 |
| N3 | PlaylistView (~280 lignes) n'est ni lotie ni dotée d'un CA de rendu, et B1 réhydrate jusqu'à 1 000 lignes alors que §9 promet « aucune tâche > 100 ms ». Aucun profilage n'est rejoué après B. | B1 |
| N4 | Critères non mesurables ou qui se neutralisent : « titre en ≤ 3 interactions » ne définit pas le compteur ; « aléatoire < 2 s » ne dit pas quoi chronométrer ; « aucune tâche > 100 ms liée aux lignes » n'a pas de critère d'attribution ; « en ES zéro chaîne FR » passe avec un dictionnaire vide puisque tr retombe sur l'EN. | A3, B2 |
| N5 | Trois campagnes de profilage (A1.0, après A1, après C1) sont budgétées dans 0,5-1 j de vérification transverse, et h5 autorise à valider « plus de jank » en throttling desktop « non vérifié sur mobile réel » — le gate central peut être franchi sans mesurer l'appareil cible. | A1.0 |

**Conséquence pratique (N5)** : A1.0 n'est pas une formalité. Si la mesure ne confirme pas le jank sur le téléphone réel, le sélecteur, la mémoïsation et la moitié du chantier A perdent leur justification — et c'est un bon résultat, pas un échec. Mesurer avant de coder.
