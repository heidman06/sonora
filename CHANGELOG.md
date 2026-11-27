# Changelog

## v2.13.2 - 2026-11-27
- HLS : tentative de streaming progressif du .ts (pipe ffmpeg + probesize réduit). **Aucun gain mesuré** : les m4a bruts de googlevideo ont l'atome moov en fin de fichier, ffmpeg doit donc lire tout le morceau avant de produire le segment ; les fichiers déjà cachés (finaliser = faststart) restent servis en 0,1–0,5 s. Le code est conservé (utile si le fichier est faststart) sans régression.
- Constat : le cache de streaming est côté serveur (data/musique ~2 Go + data/hls ~1,6 Go) ; seuls les téléchargements « Offline » sont côté client (IndexedDB).

## v2.13.1 - 2026-11-27
- Tests : le harnais e2e du fast-start passe par le sidecar InnerTube (plus Piped) ; override `SONORA_RESOLVER_ALLOW_INSECURE` réservé aux tests.

## v2.13.0 - 2026-11-27
- Résolveur InnerTube local (sidecar `resolver/`, youtubei.js, port 8090) : URLs googlevideo m4a en ~0,9 s, avec cache 5 h et repli yt-dlp. Le hub proxifie le Range immédiatement (X-Sonora-Fast).
- Mesures prod : titre à froid **4,66 s → 1,55 s** (206 + X-Sonora-Fast=1) ; segment HLS à froid avec audio réel 3,6 Mo ; avec URL pré-résolue, segment en ~0,7 s.
- `resolve-url.mjs` : sidecar d'abord, yt-dlp en secours ; prefetch des titres visibles désormais quasi instantané.

## v2.12.1 - 2026-11-27
- FIX « le titre avance mais pas de son » : un bloc legacy du handler /musique/dl référençait rapideActif/resoudreRapide après leur suppression des imports → ReferenceError → 502 « proxy error » instantané à chaque requête froide d'ffmpeg, qui générait alors un segment de SILENCE (le morceau avançait sans son). Bloc supprimé.
- HLS : en cas d'échec de génération, un seul retry après 3 s avant le fallback silence ; le silence n'est plus réutilisé que 60 s (au lieu de 10 min).
- Proxy Range borné à 2,5 s pour ne jamais bloquer la lecture.
- Mesures : segment HLS à froid 4,87 s (audio réel) ; avec URL pré-résolée 694 ms.

## v2.12.0 - 2026-11-27
- Pré-résolution spéculative : les 3 premiers titres visibles (recherche, likes, téléchargements, playlist) et les têtes de mixes sont résolus côté serveur (POST/GET /api/mus/prefetch) dès l'affichage. Mesure prod : titre à froid pré-résolu servi en 100 ms (206, X-Sonora-Fast=1) au lieu de ~4 s.

## v2.11.1 - 2026-11-27
- Résolveur : --extractor-args youtube:player_skip=configs → résolution à froid 4,65 s → 4,05 s (mesuré) ; s applique à la pré-résolution des têtes et des titres préchargés.

## v2.11.0 - 2026-11-27
- Pré-résolution des URLs audio (yt-dlp -g + cookies, cache TTL 5 h) et proxy Range googlevideo : les têtes de mixes sont pré-résolues dès /api/mus/mixes2 et chaque titre préchargé (HEAD) l'est aussi. Mesure prod : première tête de mix à 77 ms (X-Sonora-Fast=1) au lieu de ~4,6 s.
- Piped local vérifié : image déjà à jour, 0 audioStreams (protection YouTube) → non utilisable comme résolveur ; le chemin Piped reste opt-in.

## v2.10.0 - 2026-11-27
- Démarrage rapide audio (opt-in SONORA_FAST=1) : résolution Piped + proxy Range googlevideo (allowlist par saut, m4a, fallback strict, 416/403, plafond de flux) ; tests unitaires + e2e (206 sans yt-dlp, HEAD sans Piped). Désactivé par défaut : le Piped de cette instance renvoie 0 audioStreams et yt-dlp reste à ~4,6 s de résolution, donc aucun gain mesuré en prod.
- Correctif réel des blancs entre titres : prefetch réarmé à chaque transition HLS (v2.9.4).

## v2.9.4 - 2026-11-27
- File HLS iPhone : prefetchNext est réarmé à CHAQUE transition de piste (avant, seulement au démarrage de la file → 2 titres préchargés puis plus rien, d'où ~4,6 s de téléchargement à chaque morceau). Les 2 titres suivants sont maintenant préchargés en continu.

## v2.9.3 - 2026-11-27
- Player mobile : scrollbar du contenu masquée (plus de barre grise à droite, largeur rendue aux contrôles) ; le scroll reste tactile/molette

## v2.9.2 - 2026-11-27
- Player mobile : le contenu (pochette→paroles) scrolle dans .player-scroll ; le bouton File d'attente reste HORS scroll, toujours visible en bas, jamais recouvert par les paroles ni l'état vide ; desktop conserve la grille + Queue sticky

## v2.9.1 - 2026-11-27
- Bouton File d'attente (Queue) toujours visible : sticky en bas du player avec fond dégradé opaque → les paroles ne le recouvrent plus et il reste accessible sans scroller

## v2.9.0 - 2026-11-26
- Vue player : le scroll passe sur .player (interne) ; la sheet (fond artwork flouté + vignette) ne scrolle plus → suppression de la couture horizontale / bande de couleur différente en bas ; fond ambiant uniforme ; file d'attente en flux sous les paroles ; scroll tactile/molette opérationnel

## v2.8.9 - 2026-11-26
- Scroll mobile réparé dans la vue player/paroles : la sheet était overflow:hidden (contenu clipé, aucun scroll possible) → overflow-y:auto + touch-action pan-y + overscroll contain sur le panneau paroles ; la sheet et les paroles défilent maintenant au doigt/molette

## v2.8.8 - 2026-11-26
- Paroles : reveal fiable à l'ouverture (scrollTop calculé sur la sheet) — mobile et desktop ; la sheet se cale une fois sur le panneau puis reste stable pendant l'auto-scroll confiné

## v2.8.7 - 2026-11-26
- Paroles mobile : à l'ouverture du panneau, la sheet se cale une fois dessus (reveal) pour que les paroles soient visibles sans chercher ; ensuite l'auto-scroll reste confiné au panneau ; marge de séparation sous les actions

## v2.8.6 - 2026-11-26
- Sheet player / panneau paroles : scroll horizontal masqué (plus de barre horizontale intempestive en bas de la sheet)

## v2.8.5 - 2026-11-26
- Paroles : l'auto-scroll est confiné au conteneur de paroles (scrollTop interne) au lieu de scrollIntoView qui faisait monter la page/sheet à l'infini ; hauteur bornée (46vh) + pleine largeur dans la grille desktop → la vue ne casse plus ; la ligne active reste centrée, tap = seek

## v2.8.4 - 2026-11-25
- Recherche desktop : scope « Podcasts » intégré au segmented (5e onglet) avec résultats inline (top pays par défaut, recherche par pays) ; chip orpheline masquée sur desktop ; segmented compact inline ; empty-state resserré ; mobile inchangé (chip conservée, 3 onglets)

## v2.8.3 - 2026-11-25
- Nouveaux épisodes : pochettes du show affichées (l'API /api/pod/new renvoie show_image ; avant, cases grises vides)

## v2.8.2 - 2026-11-25
- Sélection podcasts = top 25 Apple par pays (FR: Les Grosses Têtes, US: The Daily, ES: El Partidazo de COPE) avec vraies pochettes ; plus de shows streamables par pays

## v2.8.1 - 2026-11-25
- Scrollbars desktop fines et discrètes partout (file d'attente, sheets, panneau droit) : plus de barre native claire à droite ; révélées au survol
- Découverte podcasts : iTunes Search par pays (FR/US/ES) avec feedUrl + fallback gpodder ; Sélection = top podcasts Apple par pays (les plus écoutés) avec vraies pochettes ; « jordi wild » (ES) trouve désormais The Wild Project

## v2.8.0 - 2026-11-25
- Podcasts façon Spotify : découverte gpodder (sans clé) + sélection FR/EN/ES + import RSS manuel ; page show (pochette/description/suivre/refresh), nouveaux épisodes, reprise de progression per-compte, vitesse jusqu'à 2× sur les épisodes, sleep/download réutilisés ; audio épisodes proxy Range + cache séparé + URL signées HMAC ; garde anti-SSRF (https strict, IP privées/DNS pin, redirects re-gardés) ; gardes 'ep' serveur (likes/playlists/history/feedback) ; file séparée musique/épisodes ; mobile 3 onglets intact ; 89 tests serveur + 91 vitest verts

## v2.7.3 - 2026-11-25
- Desktop : correction d'une régression de la v2.7.2 — le remplissage accent des sliders seek/volume avait été écrasé par un fond gris plat (le niveau ne se voyait plus) ; le dégradé accent piloté par --fill est restauré, pouces recentrés verticalement (margin-top -4/-3px) ; le curseur reflète de nouveau le niveau réel

## v2.7.2 - 2026-11-25
- Desktop : icônes au trait unifié 1.6 (au lieu de 1.8) et tailles optiques cohérentes par contexte (sidebar 18, player 17-18, lignes 16, header 16), hiérarchie de couleur txt-3→txt→accent, sliders seek/volume fins (pouce 12/10px), durées et sous-titres en tabular/teinte discrète, boutons header 36px homogènes ; mobile conserve le trait 1.8 d'origine

## v2.7.1 - 2026-11-25
- Desktop : suppression du halo rectangulaire sous le header (source du décalage noir en haut) ; header transparent au repos (aucun rectangle), opaque + filet + pleine largeur jusqu'au panneau uniquement au scroll ; l'état scrollé est branché sur le défilement interne de la colonne ; mobile inchangé

## v2.7.0 - 2026-11-25
- Desktop : les mixes passent en vraie grille (plus de carte tranchée ni de fondu), barre de défilement invisible au repos et révélée au survol, bande vide à droite supprimée quand aucun titre ne joue (la place du panneau n'est réservée que s'il existe), halo ambiant accent en haut d'accueil, rythme resserré, état actif de la sidebar teinté ; mobile inchangé

## v2.6.3 - 2026-11-25
- Desktop : gouttière de 18px entre le contenu et la barre de défilement (la barre ne chevauche plus les cartes), fondu de 26px en bout des rangées horizontales, panneau droit repensé (pochette arrondie 20px, file scrollable indépendante, actions épinglées sous un filet), respiration basse de colonne ; mobile inchangé

## v2.6.2 - 2026-11-25
- Desktop : molette fonctionnelle partout (sidebar/header/panneau, sauf zones scrollables), header opaque (fini le contenu qui bave dessous) avec hairline au scroll, hairline du panneau file, padding bas de colonne

## v2.6.1 - 2026-11-25
- Desktop : le contenu défile dans sa colonne (plus de scrollbar à l'extrême droite de la fenêtre) avec une barre fine, arrondie et discrète (thumb 3px de marge, couleur token, hover plus contrasté, min 40px) ; html/body figés à >=1000px pour éviter le double scroll ; mobile <=999px inchangé

## v2.6.0 - 2026-11-25
- Desktop : couche visuelle append-only (>=1000px) — contenu centré à 1040px, H1 40px, chips et titres resserrés, cartes 184px, lignes de pistes plus denses, recherche 640px, en-têtes conservés au scroll, hovers thème clair via tokens, rayons de focus corrects, reduced-motion respecté ; mobile <=999px strictement inchangé

## v2.5.8 - 2026-11-25
- Mixes : MIXES_VERSION porté à 2 (serveur + client) pour invalider les caches contenant les anciennes coquilles vides ; les comptes froids reçoivent désormais 3 mixes remplis (18 titres, 4 pochettes) et les comptes chauds récupèrent leurs mixes réels avec images

## v2.5.7 - 2026-11-25
- Hover des titres adouci (scale 1.06 au lieu de 1.5, z-index du bouton) : le bouton play/pause n'est plus recouvert
- Mixes des comptes froids : 3 mixes remplis (18 titres + 4 pochettes chacun) depuis resolve_cache, au lieu de coquilles vides ; clic = lecture directe

## v2.5.6 - 2026-11-25
- Recherche : doublons supprimés (dedupe par videoId, y compris au chargement suivant)
- Égaliseur : l'animation se fige réellement en pause (attribut data-playing + animation-play-state)
- Ligne de titre : bouton play/pause dédié (40x40 mobile), play si titre non courant, pause sinon
- Mixes froids : pochettes en mosaïque dégradée par mood (fin des tuiles grises)
- Playlist vide : message + bouton « Ajouter des titres » vers la recherche

## v2.5.3 - 2026-11-25
- Inscription : champ « Code d'invitation » dans le formulaire (mode création de compte) + message explicite en cas de code requis/invalide ; api.register/engine.register transmettent le code

## v2.5.2 - 2026-11-25
- Logo aligné sur la marque retenue : squircle dégradé corail→magenta→violet avec waveform blanche (3 barres arrondies) ; favicon, icônes 180/192/512 et maskable régénérées, sources SVG à jour

## v2.5.1 - 2026-11-25
- Nouveau logo/favicon : squircle sombre avec halo, disque dégradé rose→violet, anneau lumineux et bouton play blanc lisible dès 16 px ; icônes 180/192/512 + maskable régénérées, SVG source ajouté (frontend/public/icon.svg)

## v2.5.0 - 2026-11-25
- Securite de l'exposition publique : passerelle dediee Sonora-only (allowlist, 404 hors Sonora, rate-limit par IP), inscription fermee par code d'invitation (SONORA_SIGNUP_CODE), /api/piped reserve aux sessions, en-tetes de securite, dashboard retire du 443 public (tailnet :8449)
- Recherche : CTA « Connecte-toi pour chercher » pour les invites
- Docs : SECURITY-PUBLIC.md + TUNNEL.md (gateway 3012, dashboard 8449, restauration serve)

## v2.4.7 - 2026-11-25
- Accueil invité : plus de fausses cartes de mix (coquilles à pochettes vides qui ressemblaient à un chargement infini) — une carte « Connecte-toi pour tes mixes » avec bouton Sign in ; les comptes froids gardent leurs mixes de secours avec une tuile typée au lieu de cases grises

## v2.4.6 - 2026-11-25
- Lecteur : refonte verre Apple — bouton fermer dégagé des bords (inset 16/12 + safe-area), pochette réduite (58vw/260 px, 56vw/230 ≤400 px) pour rendre de l'espace vertical, contrôles et actions en verre translucide (hairline, highlight interne, blur saturé, ombre douce), état actif teinté accent, espacements resserrés (meta 18, controls 14, player 8)

## v2.4.5 - 2026-11-25
- Lecteur mobile : la rangée de 7 actions ne déborde plus — grille 4+3 cellules avec libellés courts (Aimer/Ajouter/Paroles/Sommeil/Vitesse/Radio/Offline) ×3 ; sur ≥700 px une seule rangée d'icônes sans libellés ; icône ondes dédiée pour la radio (plus de confusion avec l'onglet Écouter)

## v2.4.4 - 2026-11-24
- Téléchargements résilients : manifeste local (localStorage) en plus d'IndexedDB ; si le stockage IDB est vidé/indisponible (pression mémoire iOS, upgrade bloqué), la liste est restaurée depuis le manifeste avec un badge « copie hors ligne perdue » et la lecture re-télécharge automatiquement la copie ; retry IDB (2 tentatives) ; la liste en mémoire n'est plus jamais vidée par une erreur transitoire ; une copie blob vide n'est plus utilisée comme source (stream + re-sauvegarde)

## v2.4.3 - 2026-11-24
- Recherche : plus de double état vide (« Search » + « No results ») quand aucune requête n'est saisie ; les blocs de résultats (titres/vidéos/artistes/albums) ne se rendent que si une requête est présente ; l'état vide unique affiche les chips personnalisées

## v2.4.2 - 2026-11-24
- Plus de lecture automatique à la réouverture de l'app : au boot l'élément media est mis en pause sans src (la file et le titre restent pour une reprise manuelle), et toute tentative de play avant un premier geste utilisateur (tap/clavier/contrôle MediaSession) est refusée — y compris la restauration de session media iOS

## v2.4.1 - 2026-11-24
- « Récemment écouté » sans doublons : /api/mus/history renvoie désormais un titre distinct par videoId (dernière écoute gardée, ROW_NUMBER PARTITION BY) + dédup côté client en ceinture-bretelles ; le journal d'écoutes brut reste intact pour les stats/top
- Nettoyage en prod des 23 lignes d'historique « QA » laissées par les sweeps automatisés de vérification ( artefacts de test, pas des écoutes utilisateur )

## v2.4.0 - 2026-11-24
- Tes Mix façon Spotify : 8 à 12 mixes personnalisés par compte (daily par artiste, mixes par mood, découvertes, en boucle, favoris, archives, rotation, vrac), 15–60 titres selon corpus, covers mosaïque 2×2, noms/sous-titres localisés ×3 ; endpoint /mixes2 (cache mix_cache TTL 45 min + seed jour UTC, purges événementielles + epoch anti-résurrection, warm borné cooldown 6 h daily-only) ; /mixes v1 legacy inchangé ; vue #/mixes + détail ; chips de recherche personnalisées (4–6 scorées / 6 statiques) ; design Elephant-Goldfish rév. 2 (22 constats corrigés)

## v2.3.3 - 2026-11-24
- Icônes explicites : crayon pour renommer une playlist, ondes pour « lancer la radio », compteur pour la vitesse (l'ancien glyphe « rays » ressemblait à un spinner de chargement)

## v2.3.1 - 2026-11-24
- Correctifs responsive iPhone : rangée d'actions playlist scrollable depuis le début (plus de boutons rognés aux deux bords), bouton renommer aligné à côté du titre (plus de pastille orpheline), menu ⋯ / ajout / import en vraie feuille basse avec scrim et rangées 48 px (plus de plein écran transparent), cibles tactiles like/⋯/corbeille 40×40 px (étaient 27×20), gouttières resserrées ≤ 400 px

## v2.3.0 - 2026-11-24
- Moods d'exploration personnalisés par compte : pools localisés 14×3 (FR identique à l'existant, EN/ES marchés US-UK/LatAm), scoring local déterministe (artistes mappés cap 24 + tokens récents cap 12, alias cross-marché), 2 chips « parce que tu aimes X », exploration = découverte (moods non signalés d'abord), endpoint GET /api/mus/moods?lang (cache compte+langue TTL 30 min, purge sur like/feedback/éditions playlist), skeleton chips + stale-while-revalidate localStorage borné LRU 12, effets HomeView séparés (switch de langue = 1 fetch), garde de course ; tests 48/48 backend + 85/85 frontend ; design Elephant-Goldfish rév. 2 (18 constats corrigés)

## v2.2.5 - 2026-11-24
- Correctif boutons : la file HLS n'est plus tentée sur Chrome/Android (canPlayType « maybe » mensonger) — réservée à iOS/Safari (« probably ») ; en mode direct, next/prev/seek/vitesse/crossfade/repeat fonctionnent normalement sur Chrome desktop et Android
- Radio : seed imposé en tête de file côté client (design F6)
- UndoToast : classe undo-toast (testabilité)

## v2.2.4 - 2026-11-24
- sleepHalted réarmé par toute intention de lecture utilisateur (playTrack, reprise, bascule de compte) : le crossfade redevient opérant après un déclenchement de la minuterie ; garde CLI du resolver par realpath (liens symboliques) ; réserves documentées dans LIMITATIONS.md (filet i18n figé, sleepHalted, garde resolver)

## v2.2.3 - 2026-11-24
- Course sleep-minutes × crossfade fermée par un marqueur sleepHalted survivant au reset de sleep (garde du relais, abandon de la rampe, shouldArm) + test ; setRate met à jour fadeMedia ; garde CLI du resolver par import.meta.url/pathToFileURL ; DECISION.md arithmétique corrigée

## v2.2.2 - 2026-11-24
- Résidus de la re-revue finale : relais crossfade ne journalise plus de titre fantôme quand le sleep repause ; fadeMedia calé sur la vitesse utilisateur et dans le viewport (iOS) ; scroll de rehydratation après commit des derniers lots ; dédup in-flight de radio() (un seul warm par seed) ; garde CLI de musique-resolve (module importable, tests v21c réellement exécutés : 32/32) ; SW ne purge jamais sans meta ; clés seed i18n couvertes par le test ; timing d'extraction palette exposé pour les CA

## v2.2.1 - 2026-11-24
- Correctifs de la revue finale Goldfish (18 constats) : filet ended capture (sleep), garde sleep×crossfade, rehydratation TrackList non corrompue, vitesse persistée via defaultPlaybackRate, sémaphore recos simple prise, warm radio non court-circuité, undo avec toasts + ordre reconstruit, classe playing, DOM page ≤ 100 (batchSize 20), saveQueueAsPlaylist bulk, sélecteurs média réels, SW meta-cache, palette négative évincée, registerSw dans main, compte à rebours sleep en-tête, /stats GET-only, tests supplémentaires (resolver ordre, statsPour, sleep ended, crossfade sleep, i18n dynamiques), artefacts perf + captures commis au dépôt

## v2.2.0 - 2026-11-24
- Refonte visuelle incrémentale « Apple Music × hi-fi » : tokens contraste AA (tout texte ≤ 13 px, dark+light, pire cas translucide recalculé couche/couche), gradient blanc du mini/tabs supprimé, verre .78
- Ambient dynamique par pochette (buckets 32×32, cache de promesses 64, reset explicite, color-mix + repli rgba) + halo player dédié ; CSS mort .ambient supprimé
- Motion system : springs CSS (ouverture 420 ms / fermeture 240 ms avec variante desktop centrée), morph play/pause, burst du like 6 particules, stagger 1er lot ≤ 12 lignes, kill prefers-reduced-motion étendu aux delays + timers JS
- Typo Inter Variable OFL (latin 48 256 o transférés, unicode-range), tabular-nums généralisé, précache SW étendu aux woff2
- Panneau « Now playing » 320 px ≥ 1500 px (rang dépouillé 6 éléments, ≤ 52 nœuds, mount conditionnel)
- 6 états vides illustrés (SVG stroke 1.8, ≤ 10/11 nœuds, pleine largeur en grille) ; test i18n anti-hints-orphelins
- Micro-détails : mute réel avec restauration, temps restant au survol desktop + aria-valuetext, reset ranges webkit+moz (plus de bleu natif), preview pochette hover CSS, badge langue globe+code, toggle thème animé, icônes ±10 s distinctes
- Marque : manifest purpose any + entrée maskable dédiée (50 % safe-zone), favicon.svg référencé, theme-color meta dynamique (#07070a / #f7f7f9)
- QA : tsc 0 erreur, vitest 76/76 (dont contrast + palette), build OK ; audio/* et server/* intouchés

## v2.1.0 - 2026-11-24
- Lot 0 : 17 correctifs backend/frontend (silence HLS éphémère, course .part, LRU réel, AbortSignal, shuffle Fisher-Yates + restauration, bascule compte sans désync, reprise session iOS, durées HLS réelles, filtre mixte à limites de mots, métadonnées CarPlay/feedback, ordre imports Spotify, i18n toasts/aria/ErrorBoundary, Espace sans hijack des boutons)
- Lot 1 : seek au relâchement, volume masqué iOS, barre desktop enrichie (repeat/shuffle/ajout/download/±10 s/vitesse), retour + scroll restauré, pochettes HD same-origin (maxres→mq), skeletons, égaliseur, progression download %, version injectée
- Échelle : TrackList à délégation (index absolu, lots 100, rehydratation rAF), sélecteur usePlayerSelector à cache d'égalité, UiState (11 consommateurs), vue #/liked filtrée, bibliothèque réordonnée, drapeaux stale par source, test i18n durci (keysets + littéraux + copies EN→ES)
- Playlists : colonne position (backfill unique, NULL-last), bulk ≤100 avec durées, reorder transactionnel, renommage inline, retrait + undo 5 s par compensation, export M3U/JSON, import YouTube avec aperçu + compensation, ConfirmDialog accessible
- Features : paroles synchronisées lrclib (cache IDB v2 durci), minuterie de sommeil (mode fin + filet ended), crossfade direct égal-power (blob révoqué), vitesse 0.75–1.5× + Shift+flèches ±10 s + handlers MediaSession, radio par titre/artiste + CarPlay getSimilarSongs2, playlists intelligentes top/recent/never, statistiques #/stats (history.duration + NULLIF + invalidation cache), service worker app-shell offline + bannière MAJ sans coupure, alertes ntfy (timer 5 min, dédup 6 h)
- QA : node:test 30/30, vitest 62/62, smoke prod 14/14, QA API 54/54 ; DOM froid ≤ 100 ; boot offline vérifié

## v2.0.3 - 2026-11-24
- Lock screen / Now Playing progress now uses the current track duration via MediaSession setPositionState
- Fixes negative/queue-length remaining time on iOS lock screen for HLS queues

## v2.0.2 - 2026-11-24
- Desktop layout: sidebar navigation, wide content and a dedicated player bar
- Desktop player is now a two-column dialog; mobile keeps the full-screen sheet
- Home hero with greeting/date; light-theme sidebar fixed
- Album playlists resolved through yt-dlp when Piped returns metadata only
- HLS track changes now update history and MediaSession metadata
- Keyboard shortcuts on PC (Space, ArrowLeft/ArrowRight)

## v2.0.1 - 2026-11-24
- PWA update badge now respects React playback state (no forced reload while playing)
- Final React build deployed as the production  client

## v2.0.0 - 2026-11-24
- New React 19 + Vite 7 + TypeScript web client is now the default at `/musique/`
- Legacy vanilla client preserved at `/musique-legacy/`
- Queue editing (move/remove), download removal, error boundary and typed audio engine
- Docker/CI now build and ship the React client

## v1.19.0 - 2026-11-24
- HLS: unavailable tracks now produce a silent segment instead of a 502, so the native queue keeps advancing
- HLS segment URLs carry the track duration for accurate fallback segments

## v1.18.0 - 2026-11-24
- iOS background playback: native HLS queue (`/musique/hls/index.m3u8`) so tracks advance with the screen locked
- On-demand HLS audio segments generated with ffmpeg and cached
- Automatic fallback to per-track audio if HLS is unavailable

## v1.17.2 - 2026-11-24
- Background playback: tracks now advance synchronously on ended (no async IndexedDB wait)
- Prefetch of the next two tracks for faster transitions and iOS background

## v1.17.1 - 2026-11-24
- Playback resilience: stall watchdog, automatic recovery and skip of unavailable tracks
- Anonymized screenshots (demo account, no personal playlist names)

## v1.17.0 - 2026-11-24
- English UI added and set as the default language on first launch
- Language switch now cycles English, Spanish and French
- Fixed mobile bottom navigation alignment (equal-width, centered icons)
- English screenshots refreshed

## v1.16.2 - 2026-11-24
- Added banner and fresh mobile/desktop screenshots to the README
- Translated all source-code comments to English
- No functional change

## v1.16.1 - 2026-11-24
- English documentation for the public open-source repository
- README badges, English release checklist and package metadata
- No functional change

## v1.16.0 - 2026-11-24
- Durations extended to likes and history
- Public GitHub release (sanitized history)

## v1.15.0
- Real durations in the app API (playlists, likes, history)
- Shared duration module and Subsonic duration support

## v1.14.0
- Offline playback prefers downloaded blobs over stream cache

## v1.13.0
- Real durations for Subsonic/CarPlay, NOTICE

## v1.12.0
- Release documentation, publishing checklist, verified bundle

## v1.11.1
- Cold-cache smoke tolerance, feedback triggers recompute

## v1.11.0
- Recommendation feedback (dismiss/like) with UI

## v1.10.0
- Recommendations v3 with Piped related seeds

## v1.9.0
- Subsonic albums and artists mapping, CarPlay test guide

## v1.8.0
- Amperfy endpoint coverage, Subsonic auth cache, load test

## v1.7.0
- Subsonic gateway for CarPlay/Amperfy

## v1.6.0
- Daily Mixes

## v1.5.0
- API input validation fixes

## v1.4.0
- Session TTL and logout revocation, mix anti-repetition

## v1.3.0
- Dockerfile, compose, CI, node:test suite

## v1.2.0
- Standalone server, audio extraction, environment config

## v1.1.0
- Recommendations v2, Mix, health endpoint, smoke test

## v1.0.0
- Initial PWA: accounts, playlists, likes, history, Spotify import
