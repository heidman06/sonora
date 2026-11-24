# DESIGN rév. 2 — Sonora v2.2 · Refonte visuelle incrémentale « Apple Music × hi-fi premium »

**Statut** : révision 1 passe de correction, verdict Goldfish NEEDS-WORK (20 constats). Chaque correction est taguée **[Cn]**. Même contrat 9 sections, aucune dépendance, aucune écriture disque par le concepteur.

**Contexte réel acté** : dépôt à l'état v2.1.0 déployé. Déjà présents : src/assets/inter-latin.woff2 (48 256 o), inter-latin-ext.woff2 (85 068 o), OFL-Inter.txt (OFL 1.1), public/favicon.svg (linearGradient 3 stops), public/icon-maskable-512.png (disque blanc 256/512 = 50 %, conforme safe-zone 80 %). manifest.webmanifest:12-25 porte "purpose": "any maskable" sur les 2 entrées ; index.html:6 = #08080a. Aucun @font-face n'existe encore. Un .q-row réel = 19 éléments. Clés hints existantes : searchHint, noDownloadsHint, noPlaylistsHint, importHint.

| Constat | Correction | Section |
|---|---|---|
| C1 empilement mini | gradient blanc supprimé sur .mini/.tabs ; ratios recalculés couche/couche | §3 V2, S1 |
| C2 plafonds nœuds | rang panneau dépouillé 6 él. (panneau 50 ≤ 52) ; EmptyState 6+N ≤ 10/11 | §3 V3/V6 |
| C3 reduced-motion | kill + animation-delay:0s !important ; timer fermeture 0 ms via matchMedia | §3 V4, S2 |
| C4 halo player invisible | .player-halo (1 nœud, z2) porteur de --dyn-* | §3 V1, S4 |
| C5 txt-3 sur translucide | seek-times/dp-seek/dp-vol/dp-artist/vol-ios/queue-btn → txt-2 | §3 V2, S1 |
| C6 mute fantôme | toggle mute réel avec restauration + clés mute/unmute ×3 | §3 V8, S7 |
| C7 temps restant | hover déclaré avant early-return ; aria-valuetext ; CA desktop only | §3 V8, S7 |
| C8 modal desktop | keyframes desktop opacity+scale(.96) conservant translate(-50%,-50%) | §3 V4, S2 |
| C9 repli contradictoire | applyAmbient(null) = reset explicite aux valeurs initiales | §3 V1, S4 |
| C10 alpha halo | color-mix(in srgb, var(--dyn-N) calc(var(--dyn-alpha)*100%), transparent) + repli rgba static | §3 V1, S4 |
| C11 chip-mini & teintes | fond tokenisé 8 % ; foot-btn.on/tremove:hover → var(--accent) ; décoratifs actés | §3 V2, S1 |
| C12 polices | noms réels mesurés ; unicode-range latin dont U+0152-0153 ; 48 256 o transférés ≤ 120 KB | §3 V5, S5 |
| C13 assets présents | S9 = éditions (manifest purpose, index #07070a), pas de ✚ | §3 V7, S9 |
| C14 dot SVG | approximation linearGradient 3 stops actée ; maskable 50 % acté | §3 V7 |
| C15 StrictMode | cache de promesses in-flight Map<id, Promise<Palette|null>> | §3 V1, §5 |
| C16 empty playlists | grid-column: 1 / -1 dans .pl-grid | §3 V6, S6 |
| C17 same-origin | restreint aux pistes ; thumbOf pour streams ; artistes/albums externes actés + repli | §3 V8, §5 |
| C18 reset ranges | reset webkit+moz complet en S7 ; CA « ranges sheet » déplacé S1→S7 | §3 V8, S7 |
| C19 hints orphelins | réutilisation noDownloadsHint/noPlaylistsHint ; test « toute clé Hint consommée » | §3 V6, §7 |
| C20 périmètre AA | mandat « tout texte ≤ 13 px » ; tous les sites au tableau + CA | §2 I7, §3 V2, §9 |

## 1. Objectif / non-objectifs

**Objectif** : faire passer Sonora v2.2 d'un « dark glass générique » à un « Apple Music × hi-fi premium » cohérent mobile/desktop par retouches additives (tokens, ambient dynamique, motion, typo, états vides, marque, micro-détails), sans réécriture, sans dépendance, sans régression audio/SW/i18n/perf, critères décidables.

**Non-objectifs** : refonte layout mobile ; moteur audio/HLS iOS ; cache audio Cache Storage ; proxy thumbnails artistes/albums Piped ; réécriture des .q-row de QueueSheet ; View Transitions API ; illustrations bitmap ; police payante ; changement de routage hash.

## 2. Contraintes / invariants

| # | Invariant | Source |
|---|---|---|
| I1 | package.json inchangé (react/react-dom 19). Polices = woff2 déjà commis + @font-face à écrire. | package.json:13-25 |
| I2 | DOM ≤ 100 .track à froid ; retour ≤ 1000 (rAF 2 lots/frame). .q-row/.pl-card/.np-row exclus. | DESIGN-echelle-playlists.md:73, TrackList.tsx:20-50 |
| I3 | Renders App ≤ 2/min en lecture ; 0 tâche > 100 ms attribuable ; frame médian ≤ 25 ms/10 s scroll. | DESIGN-echelle-playlists.md:81-87 |
| I4 | SW allowlist stricte, /api/* jamais intercepté ; évolutions additives re-versionnant ; pas de skipWaiting auto. | sw.js:27-35, 83-98 |
| I5 | i18n ×3 : keysets égaux, clés littérales existantes, 0 littéral aria/placeholder/title, 0 ternaire trilingue, 0 copie EN→ES ; + toute clé *Hint déclarée consommée [C19]. | i18n.test.ts:19-69 |
| I6 | prefers-reduced-motion : kill étendu à animation-delay:0s !important, transition-delay:0s !important, animation-iteration-count:1 !important [C3] ; timers JS motion = 0 ms via matchMedia ; burst non monté. | app.css:375-377 |
| I7 | WCAG AA ≥ 4.5:1 sur TOUT texte ≤ 13 px [C20], dark+light, pire cas translucide inclus ; ≥ 3:1 icônes. Périmètre : tab 10.5, seek-times 11.5, dp-seek 10.5, dp-vol 10.5, dp-artist 11.5, side-label 10.5, side-playlist 12.5, side-empty 12, dl-pct 11, track-dur 12.5, track-sub 12, card-sub 12.5, mini-sub 12, q-row dur 12, chip-mini 11, vol-ios 11.5, form-err 13. | captures + app.css:8-9,26-27 |
| I8 | audio/* zéro diff ; #media dans viewport ; HLS iOS/crossfade/sleep/rate intouchés. | app.css:826-831 |
| I9 | Pochettes de pistes same-origin /api/img (maxres→mq) ; canvas non-tainted [H] ; thumbnails artistes/albums externes avec repli placeholder [C17]. | img.ts:4-8, SearchView.tsx:138,154 |
| I10 | focus-visible anneau solide --accent conservé ; prefers-reduced-transparency conservé. | overrides.css:200-202, app.css:734-736 |

## 3. Décisions justifiées (V1–V8, rév. 2)

### V1 — Ambient dynamique : buckets 32×32, promesses in-flight, reset explicite, halo player réel

**Cible DOM [C4]** : halo global = body::before (app.css:481-487) ; CSS mort .ambient (app.css:50-64) supprimé. Dans le player : .player-halo, 1 élément monté dans PlayerSheet entre .sheet-bg et le contenu : position:absolute; inset:-30% -20% auto; height:70%; z-index:2 (au-dessus du scrim ::after z1, sous le contenu z3), deux radial-gradients en color-mix(... var(--dyn-1) var(--halo-a1) ...) / --dyn-2 var(--halo-a2), filter: blur(30px), pointer-events:none. Tokens : dark --halo-a1:26% / --halo-a2:20%, light 14% / 11%. .sheet-bg opacity .55→.35.

**Alpha écrivable [C10]** : --dyn-1/2/3 opaques (@property syntax:'<color>', clamp luminance [0.18;0.60] sur l'opaque). Consommateurs : color-mix(in srgb, var(--dyn-1) calc(var(--dyn-alpha) * 100%), transparent), --dyn-alpha = .20 dark / .10 light. Repli sans color-mix [H : Chrome 111 / Safari 16.2 / FF 113] : déclaration rgba statique précédente (palette fixe) ignorée si non supportée → halo fixe jamais cassé.

**Repli décidable [C9]** : applyAmbient(null) remet explicitement les 3 variables aux INITIAL (rgba actuels app.css:485-486). CA : computed --dyn-1 == INITIAL après échec/piste sans art.

**Cache de promesses [C15]** : Map<string, Promise<Palette|null>> plafonné 64 FIFO ; miss crée la promesse avant tout await ; double-effet StrictMode et transitions rapides partagent → 1 extraction par id ; hit < 1 ms.

**Algorithme/budget** : Image artOf(id,'mq') (320×180 [H]) → canvas 32×32 willReadFrequently → 1024 px, filtrage alpha<128 et bandes noires (luma<40, sat<12) → 48 buckets (12 hue × 2 sat × 2 val), poids count×(0.4+sat), top 3 à hue ≥ 30°, moyenne RGB, clamp → ≤ 8 ms/transition [H mobile], cible ≤ 3 ms desktop, dans rAF post-onload. useDynamicAmbient(id) = effet seul dans App → 0 render ajouté. Reduced-motion : crossfade 800 ms tué par kill étendu.

### V2 — Tokens : tableau recalculé couche par couche, périmètre ≤ 13 px

**[C1] Réduire l'empilement** : gradient blanc additif linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.03)) supprimé du fond de .mini (app.css:618-620) et .tabs (app.css:639-641). Liquid glass survit par --glass-1 .78 + blur 44/saturate 220 + liseré 1 px ::before + inset 0 1px 0 var(--glass-hi).

| Couche (pire cas) | Composite RGB | L | Texte | Composite texte | L | Ratio |
|---|---|---|---|---|---|---|
| Dark art blanc → glass-1 .78 (24,24,32) [gradient supprimé] | 74.8/74.8/81.1 | 0.0709 | txt-2 .68 | 190.5/190.5/192.5 | 0.519 | 4.71 ✓ |
| Light art noir → glass-1 .78 (255) | 198.9 | 0.5706 | txt-2 .66 | 74.2 | 0.0689 | 5.22 ✓ |
| Dark sheet haut art blanc → gradient .72 (9,9,13) | 77.9/77.9/80.8 | 0.0763 | txt-2 .68 [C5] | 191.5 | 0.524 | 4.55 ✓ |
| Dark barre haut art blanc → .82 (20,20,26) | 62.3/62.3/67.2 | 0.0492 | txt-2 .68 [C5] | 186.5 | 0.494 | 5.48 ✓ |
| Light barre haut art noir → .82 blanc | 209.1 | 0.6384 | txt-2 .66 | 77.7 | 0.0756 | 5.48 ✓ |
| Suggest art blanc → glass-1 .78 (au lieu de --glass .72, app.css:412) | 70.1 | 0.0615 | txt-2 .68 | 189.0 | 0.509 | 5.01 ✓ |

**Tokens finaux** : dark --txt-2 .62→.68 ; dark --txt-3 .38→.52 (interdit sur verre & sheet-haut & barre-haut) ; light --txt-2 .60→.66 ; light --txt-3 .36→.60 ; --glass-1 .52/.58→.78/.78 ; light --accent #fa2d55→#c81e42 (5.3 bg / 4.65 teinte 8 %) ; --line .09/.08→.12/.10 ; --err ✚ dark #ff6b6b / light #c02626 (form-err 13 px, app.css:258).

**Sites ≤ 13 px vers --txt-2 [C5/C20]** (S1) : .seek-times 11.5 (app.css:330) ; .dp-seek 10.5 & .dp-vol 10.5 (overrides.css:116,122) ; .dp-artist 11.5 (overrides.css:110) ; .vol-ios 11.5 (overrides.css:197) ; .queue-btn span 13.5 (app.css:342) ; tabs inactives 10.5 (app.css:780-782,822) ; .side-empty 12 opacity .55 supprimée (overrides.css:84) ; .q-row .track-dur 12 opacity .55 supprimée → txt-3 (overrides.css:16, fond opaque). Conservés txt-3 (fonds quasi-opaques vérifiés) : .track-dur 12.5, .side-label 10.5, .side-link/.side-all, .dl-pct 11 accent, .card-sub/.track-sub/.mini-sub/.side-playlist → txt-2.

**[C11] Teintes** : .chip-mini 11 px (app.css:432) fond rgba(250,45,85,.16) → color-mix(in srgb, var(--accent) 8%, transparent) → dark 5.08 / light 4.65 ✓ ; .track.playing (app.css:600) → color-mix accent 9 % ; .foot-btn.on #ff4d6d (overrides.css:5) & .tremove:hover #ff8fa3 (overrides.css:19) → var(--accent). Actés décoratifs : ::selection (app.css:47), halo focus box-shadow inputs (doublon de l'outline solide), dégradés .hero/.liked-card, bordures .acc-chip.on.

### V3 — Panneau ≥ 1500 px : rang dépouillé, 50 éléments recomptés

**[C2a]** .np-row = 6 éléments : button.np-row > img.np-art + span.np-txt > (span.np-title + span.np-sub) + span.np-dur. Pas de q-tools, pas d'Icon dans les rangs. Recompte : aside#np-panel 1 ; img.np-art 1 (2) ; div.np-meta+title+artist 3 (5) ; div.np-lyrics + 4×button texte 5 (10) ; div.np-queue-head 1 (11) ; 5×.np-row 30 (41) ; div.np-actions + 2×(button+svg+g+path) 9 (50). **Plafond CA ≤ 52** (querySelectorAll('#np-panel, #np-panel *').length). Paroles absentes → 1 div texte (−3). +0 .track. Mount conditionnel useMediaQuery('(min-width:1500px)'). Abonnement currentTime interne 1 render/s, lignes memo ; App inchangé. Breakpoints : <1000 mobile ; 1000–1499 sidebar 260 + barre 92 ; ≥1500 panneau 320 (right:0;top:0;bottom:92px), .app padding-right 352, barre left:260;right:0;height:92 inchangée (overrides.css:126-130 remplacé). Porte de sortie : dépôt si CA perf échoue 2×.

### V4 — Motion : kill étendu, variantes desktop, timers couverts

**[C3]** kill reduced-motion (app.css:375-377) devient : animation-duration:.001ms !important; animation-delay:0s !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; transition-delay:0s !important. Timers JS : démontage fermeture = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260 ; LikeBurst non monté si reduce ; preview hover désactivée par media query.

**[C8]** deux variantes : mobile (<1000) sheetUp translateY(100%)→0 / sortie 0→100% ; desktop (≥1000, #player seulement) sheetInDesktop from opacity:0; transform:translate(-50%,-50%) scale(.96) → to opacity:1; transform:translate(-50%,-50%) scale(1) ; sortie inverse, fill:both → centrage porté par le keyframe, saut existant corrigé. QueueSheet/AddSheet gardent translateY à toutes tailles.

| Événement | Durée | Easing | Propriétés | Reduced |
|---|---|---|---|---|
| Sheet mobile ouv/ferm | 420/240 ms | (.22,.9,.24,1)/(.5,0,.75,.4) | translateY+opacity | instantané, timer 0 |
| Modal desktop ouv/ferm | 420/240 ms | idem | opacity+scale .96↔1 en conservant translate(-50%,-50%) | idem |
| Apparition mini | 260 ms | (.34,1.28,.44,1) | translateY(14px)+opacity | instantané |
| Morph play/pause | 180 ms | var(--ease) | 2 SVG superposés, opacity+scale(.55)+rotate(∓20°) | instantané |
| Burst like | 550 ms | (.2,.7,.3,1) | 6 <i>, délais 0/40/80 ms, front montant only, démontage 600 ms | non monté |
| Stagger 1er lot | rise .38 s, délai i×22 ms, i=0..11 | var(--ease) | .list.stagger .track:nth-child(-n+12) ; au-delà animation:none | delay 0 + duration .001 → visible t0 |
| Crossfade ambient/halo | 800 ms | ease via @property | --dyn-1/2/3 | swap instantané |
| Toggle thème | 240 ms | var(--ease) | crossfade+rotate 90° | instantané |
| Preview pochette hover | 160 ms | ease-out | scale 1→1.5, ≥1000 px | désactivée |

### V5 — Typo : fichiers réels, unicode-range, 48 256 o transférés

**[C12]** @font-face ×2 famille InterVariable, font-weight:100 900, font-display:swap ; latin = U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD ; latin-ext = U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF. FR/EN/ES ne téléchargent que latin → 48 256 o ≤ 120 KB. œ U+0152-0153 dans latin ; si glyphe manque [H] repli per-glyph system sans tofu. Stack : -apple-system, BlinkMacSystemFont, "InterVariable", "Segoe UI", Roboto, sans-serif. tabular-nums généralisé. SW : extension additive install (scan CSS précachés → /assets\/[^"')]+\.woff2/) ; repli stack system si refusée.

### V6 — États vides : plafonds recomptés, hints réutilisés, pleine largeur

**[C2b]** EmptyState : div.empty-illu(1) + span.empty-illu-art(2, cercle CSS) + svg(3) + g(4) + N paths + div.empty-title + div.empty-hint = 6+N. N : heart 1→7 ; search 2→8 ; library/download/note/globe 3→9 ; globeOff 4→10. **Plafond ≤ 10 sans action, ≤ 11 avec action texte**. Rayons/cercle en ::before/::after (0 DOM). Charte stroke 1.8 conservée.

**[C19]** réutiliser searchHint/noDownloadsHint/noPlaylistsHint ; créer seulement noFavoritesHint, offlineHint, lyricsHint ×3. Test : toute clé /Hint$/ déclarée doit apparaître dans un usage tr(/t( du src.

**[C16]** .pl-grid > .empty-illu { grid-column: 1 / -1 }.

Écrans : search sans requête (SearchView.tsx:121), likés/downloads vides (TrackList.tsx:82 via emptyKey), playlists vide (LibraryView.tsx:155), recherche offline/erreur (SearchView.tsx:123-128, globeOff si !navigator.onLine), paroles absentes/instrumental (LyricsPanel.tsx:50-58).

### V7 — Marque : éditions d'assets existants

**[C13]** S9 = éditions : (a) manifest : 2 entrées "any maskable" → "any" + 3e entrée icon-maskable-512.png purpose:"maskable" ; (b) index.html:6 #08080a → #07070a + link rel=icon favicon.svg (PNG 192 repli) ; (c) sw.js:30-35 ajout favicon.svg + icon-maskable-512.png (additif) ; (d) meta theme-color dynamique par thème dans l'effet thème (App.tsx:40-43) ; manifest theme_color dark static (limitation documentée).

**[C14]** dot conique CSS conservé (app.css:83-89, spin 9s, figé reduce). Favicon : approximation linearGradient 3 stops actée (#fa2d55→#ff6a3d→#b14bff, disque r18/64 = 56.25 %) ; conic non exprimable en SVG 1.1 autonome sans 4 quartiers path — divergence actée. Maskable disque blanc 256/512 = 50 % conforme. Wordmark texte 800, -.03em, 17/19 px.

### V8 — Micro-détails

1. Badge langue globe 14 px + code (App.tsx:95), min-width 34, aria t('language').
2. Toggle thème crossfade+rotate 240 ms.
3. **[C7]** hoverSeek déclaré avant tout early-return ; hover (pointer fine, ≥1000 px) total → −(duration−currentTime) ; mobile rien acté ; AT : aria-valuetext sur l'input range = fmt(current)+' / '+fmt(duration)+' · '+tr(lang,'remaining')+' '+fmt(restant) ; pas d'aria-live ; clé remaining ✚ ×3 ; CA hover desktop only.
4. Preview pochette hover CSS pur scale 1.5 ≥1000 px, origin left, z-index+ombre, 160 ms.
5. **[C18]** reset ranges complet S7 sur .dp-seek input, .dp-vol input, .seek input, .vol input : -webkit-appearance:none; appearance:none; fond linear-gradient(var(--accent),var(--accent-2)) no-repeat + base rgba(128,128,128,.28), background-size: var(--fill,0%) 100% (inline style) ; ::-webkit-slider-runnable-track background:transparent height:4px ; ::-webkit-slider-thumb -webkit-appearance:none margin-top:-5.5px ; ::-moz-range-track rgba(128,128,128,.28) height:4px ; ::-moz-range-progress linear-gradient accent ; ::-moz-range-thumb. CA « ranges sheet » déplacé S1→S7.
6. **[C6]** mute réel : .vol-ico (PlayerSheet.tsx:83) toggle ; prevVolume déclaré avant early-return ; clic volume>0 → mémorise + setVolume(0) ; clic 0 → restaure prev (défaut .8) ; aria-label clés mute/unmute ✚ ×3 ; volumeOff à 0 ; desktop icône volume décorative aria-hidden (DesktopPlayer.tsx:75) ; .vol-ico border-radius 50 %.
7. Icônes ±10 s back10/fwd10 (svg+g+path+text = 4 él.) remplacent prev/next dupliqués (DesktopPlayer.tsx:50,56).
8. **[C17]** Art sans fallback={track.thumb} (PlayerSheet.tsx:55, MiniPlayer.tsx:23, TrackRow.tsx:22, QueueSheet.tsx:40) → sans id placeholder --surface-2 ; dp-art & TrackCard → Art (DesktopPlayer.tsx:42, HomeView.tsx:51) ; streams SearchView : thumbOf(item) ✚ dans img.ts réécrit via videoIdOf → /api/img/vi/<id>/mqdefault.jpg ; artistes/albums Piped (SearchView.tsx:138,154) thumbnail externe acté + onError placeholder ; offline /api/img non caché → placeholder documenté.
9. focus-visible conservé.

## 4. Alternatives rejetées (ajouts rév. 2)

| Décision | Alternative | Raison |
|---|---|---|
| C1 | gradient conservé + txt-2 .80+ | 4.5 atteint seulement à .82 → hiérarchie écrasée |
| C1 | glass-1 .90 | tue le verre |
| C2 | .q-row dans le panneau | 95 > 60 |
| C2 | EmptyState 1 path | perd charte stroke 1.8 ; plafond relevé à valeur mesurable |
| C3 | animation:none en reduce | casse fill:both des skeletons ; delay 0 + duration .001 conserve états finaux |
| C4 | retirer CA halo player | perte signature ; 1 nœud moins cher |
| C8 | keyframe translateY commun | éjecte modal centré |
| C10 | couleurs translucides dans @property | clamp/crossfade dépendraient de l'alpha |
| C11 | chip-mini 16 % | light 4.08 ✗ ; 8 % → 4.65 ✓ |
| C12 | woff2 full 133 KB | viole ≤ 120 KB transférés |
| C14 | 4 quartiers path | réécriture asset accepté ; approximation actée |
| C17 | proxy artiste/album | hors périmètre /vi/ ; repli acté |
| C18 | accent-color seul | ne stylise pas track rempli cross-browser |
| V3 | panneau ≥1280 | colonne < 700 px trop juste |
| V4 | WAAPI/lib spring | dep interdite |
| V5 | 100 % system | rendu non premium hors Apple |

## 5. Interfaces / flux

- lib/palette.ts ✚ : extractPalette(img): Palette|null (pur) ; paletteFor(id) avec Map<string, Promise<Palette|null>> in-flight 64 FIFO [C15] ; applyAmbient(p|null) : p → setProperty 3 opaques ; null → reset INITIAL [C9]. useDynamicAmbient(id) effet seul, 0 render App.
- Contrat CSS : @property --dyn-1/2/3 (<color>, inherits, initial rgba fixes) :root transition 800ms ; --dyn-alpha .20/.10 ; color-mix précédé rgba statique [C10] ; --halo-a1/a2 par thème ; .player-halo 1 nœud z2 [C4].
- Flux : playTrack → state.current → effet id → paletteFor (promesse partagée) → rAF → ≤ 8 ms → setProperty → body::before + .player-halo + mini-progress + eq + ranges ; 0 commit React supplémentaire.
- hooks.ts : useMediaQuery(q) ✚. img.ts : thumbOf(item) ✚ [C17].
- PlayerSheet/DesktopPlayer : hoverSeek, prevVolume avant early-return [C6/C7] ; aria-valuetext seek ; closing App timer reduce?0:260 [C3] ; keyframes desktop #player [C8].
- EmptyState {icon,titleKey,hintKey?,action?} 6+N, grid-column 1/-1 [C2/C16]. LikeBurst {active} front montant, non monté reduce. NowPlayingPanel .np-row 6 él. ≤52 [C2].
- i18n : noFavoritesHint, offlineHint, lyricsHint, mute, unmute, remaining ×3 ; réutilisation searchHint/noDownloadsHint/noPlaylistsHint [C19] ; test Hint consommée ✚.
- Budgets : extraction ≤ 8 ms ; cache 64 promesses ; panneau ≤ 52 ; EmptyState ≤ 10/11 ; burst +7 ≤ 600 ms ; morph +3 svg ; stagger ≤ 12 ; App ≤ 2/min ; .track froid ≤ 100.

## 6. Risques / défaillances

| Risque | Mitigation |
|---|---|
| color-mix/@property absent [H] | rgba statique précédente → palette fixe ; swap instantané |
| Verre .78 moins see-through | blur 44 + saturate 220 + liserés ; compromis AA acté |
| woff2 absent boot offline | stack system swap ; extension additive testée CA avion |
| Glyphe œ absent [H] | repli per-glyph system sans tofu |
| /api/img cross-origin taint [H] | try/catch → applyAmbient(null) reset INITIAL |
| StrictMode/transitions rapides | cache promesses 1 extraction/id |
| Panneau render 1/s + fetch paroles | fetch caché IDB ; memo ; porte de sortie 2× |
| Hash SW change | UpdateBanner/SKIP_WAITING existant |
| accent light hue décalée | documenté ; dark inchangé ; dégradés décoratifs #fa2d55 |
| Hover scale chevauche | z-index+ombre+origin left ≥1000 px, reduce off |
| aria-valuetext 1/s | lu au focus/changement seulement |
| Clés Hint orphelines | règle test scan [C19] |

## 7. Stratégie de test

Pur vitest : lib/palette.test.ts ✚ (buckets, bandes noires, top-3 hue, clamp, null, dédup promesses 2 appels = 1 extraction [C15]) ; lib/contrast.test.ts ✚ (miroir tokens + couches composites art→glass→texte, art→gradient sheet→texte, art→barre→texte ; ≥ 4.5 chaque site ≤ 13 px, ≥ 3 icônes) ; règle i18n Hint consommée ✚ [C19] ; suites existantes re-passées ; tsc -b strict par étape.
Manuel chiffré : longtask+Profiler 60 s → App ≤ 2/min, 0 > 100 ms ; 10 s scroll médiane ≤ 25 ms ; .track froid ≤ 100 / retour ≤ 1000 ; #np-panel * ≤ 52 ; .empty-illu * ≤ 10/11 ; extraction ≤ 8 ms ; polices ≤ 120 KB (48 256 attendus) ; boot avion Inter ; DevTools contraste 17 sites dark+light ; reduce ON visibles t0 + fermeture même frame + burst absent ; modal desktop sans saut.
Visuel : captures §9 deux sessions A/B.

## 8. Plan d'implémentation ordonné (rév. 2)

| # | Étape | Fichiers | CA |
|---|---|---|---|
| S1 | Tokens & contraste élargi | app.css :root 1-30, glass 463-478, mini 618-620 & tabs 639-641 (gradient supprimé), tabs 780-782/822, seek-times 330, queue-btn span 342, chip-mini 432 (8 %), playing 600, suggest 412, form-err 258 (--err) ; overrides.css dp-seek 116, dp-vol 122, dp-artist 110, side-empty 84, q-row dur 16, foot-btn.on 5, tremove:hover 19, vol-ios 197 ; lib/contrast.test.ts ✚ | contrast vert ×2 ; DevTools ≥ 4.5 17 sites dark+light ×2 ; mini/tabs 4.71/5.22 |
| S2 | Motion + reduce + modal | app.css kill 375-377 étendu, eases, sheetUp 306-310, keyframes desktop, stagger 211 ; TrackList classe stagger ; App closing timer reduce?0:260 ; PlayerSheet | ouv/ferm sans saut desktop+mobile ×2 ; reduce visibles t0 + fermeture même frame ×2 ; 0 longtask 60 s |
| S3 | Morph + burst | PlayerSheet/MiniPlayer/DesktopPlayer SVG superposés ; LikeBurst.tsx ✚ ; app.css | morph sans shift 10 toggles ×2 ; burst like only démonté ≤ 600 ms ×2 |
| S4 | Ambient + halo player | palette.ts ✚ (promesses, reset), palette.test.ts ✚, App effet, app.css (@property, color-mix+repli, body::before 481-487, suppression .ambient 50-64, .player-halo), PlayerSheet (halo + sheet-bg .35) | halo global+player 2 pochettes ×2 ; null → computed INITIAL ×2 ; ≤ 8 ms ; 0 render App |
| S5 | @font-face + SW | app.css (@font-face ×2 unicode-range, --font 15, tnum) ; sw.js install scan woff2 ; assets existants | 48 256 o FR/EN/ES ×2 ; boot avion Inter ×2 ; cœur lisible ×2 |
| S6 | États vides | EmptyState.tsx ✚ (6+N ≤10/11), Icon (+globe/globeOff/back10/fwd10), SearchView 121-128, TrackList 82, LibraryView 155 (grid-column), LyricsPanel 50-58, i18n (réutil hints + 3 clés), i18n.test (règle Hint) | 6 écrans pleine largeur dark/light ×2 ; i18n vert ×2 ; nœuds ≤ 10/11 |
| S7 | Barre/player enrichis + reset | DesktopPlayer (Art, reset ranges, ±10, hover/aria-valuetext), PlayerSheet (mute réel, fill, hover, vol-ico rond), MiniPlayer/TrackRow/QueueSheet (fallback supprimé), HomeView 51 (Art), img.ts (thumbOf), SearchView 138/154 (onError), overrides (reset+preview) | aucun bleu natif Chrome+Firefox ×2 ; mute→0→restore ×2 ; hover restant desktop ×2 ; ranges sheet vérifié ici |
| S8 | Panneau ≥1500 | NowPlayingPanel.tsx ✚ (.np-row 6 él. ≤52), hooks (useMediaQuery), App mount, overrides 126-130 | présent 1600/absent 1440 resize ×2 ; ≤ 52 ; .track ≤ 100 ; App ≤ 2/min ×2 ; porte de sortie |
| S9 | Marque = éditions | manifest (purpose any + maskable), index (#07070a + favicon.svg), sw.js (+2 assets), app.css wordmark | safe-zone 50 % ×2 ; précache favicon+maskable 2 installs ; meta theme-color ×2 |
| S10 | Badge langue + toggle | App 95-98, Icon globe, app.css | globe+code FR→EN→ES ×2 ; toggle 240 ms/reduce ×2 |
| S11 | Captures + perf final | captures apres-*.png | sans régression A/B ; 0 longtask, médiane ≤ 25 ms, App ≤ 2/min ×2 |

## 9. CA observables (deux exécutions) + captures

| CA | Observable | Exécution 1 | Exécution 2 |
|---|---|---|---|
| AA ≤ 13 px | ≥ 4.5 sur 17 sites I7 | dark DevTools | light DevTools |
| AA translucide couche/couche | mini/tabs 4.71 & 5.22 ; sheet-haut 4.55 ; barre-haut 5.48 | pochette blanche | pochette noire |
| Ambient global+player | halo suit pochette ; ≤ 8 ms ; 0 longtask | A→B chaude | B→C froide après reload |
| Repli décidable | computed --dyn-1 == INITIAL | piste sans art | /api/img coupé |
| StrictMode | 1 extraction pour 2 effets | boot StrictMode | transition A→B→A |
| Reduced-motion | visibles t0 ; fermeture même frame ; burst absent ; drift off | reduce session A | session B reload |
| Modal desktop | aucun saut translate ouv/ferm ≥1000 | ouverture ×5 | fermeture ×5 |
| DOM froid/retour | ≤ 100 / ≤ 1000 | #/liked froid | #/playlist 280 puis retour 10 lots |
| Panneau | ≤ 52 ; présent ≥1500 absent <1500 | 1440→1600 | 1600→1440 + reload |
| EmptyState | ≤ 10/11 ; playlists pleine largeur | dark | light |
| Renders/scroll | ≤ 2/min ; médiane ≤ 25 ms | mobile 60 s + scroll | 1600 panneau 60 s + scroll |
| Polices | 48 256 o ; Inter ; œ ; tnum | online FR | avion puis ES |
| i18n | keysets ×3 ; 0 littéral ; 0 copie ; Hint consommée | vitest | post S6+S10 |
| SW | précache shell+assets+woff2+favicon+maskable ; /api jamais | install fraîche | re-install rebuild |
| Mute | clic → 0 + unmute ; reclic → prev | volume .8 | volume .3 |
| Restant | hover desktop −m:ss ; aria-valuetext focus ; mobile inchangé | enter/leave | focus clavier |
| Ranges | aucun bleu natif, fill accent | Chrome | Firefox |
| Marque | maskable 50 % ; favicon 3 stops ; meta #07070a/#f7f7f9 | preview maskable | toggle + meta |

**Captures** : 390×844@2x (780×1688) + 1440×900 + 1600×900 (panneau). apres-home-mobile, apres-home-desktop, apres-library-mobile, apres-player-mobile, apres-desktop-player, apres-panel-1600, apres-light-mobile, apres-light-desktop, apres-empty-liked-mobile, apres-empty-search-mobile, apres-reduce-mobile. Deux passes A/B. Divergences actées (verre .78, favicon linear, maskable 50 %, thumbnails artistes externes, pas de restant tactile) = compromis documentés.

---

**Synthèse rév. 2** : 20 constats corrigés par décisions vérifiables — empilement mini réduit (4.71/5.22 couche/couche), plafonds recomptés (panneau 50 ≤ 52 rang 6 él. ; EmptyState 6+N ≤ 10/11), kill reduce étendu delays+timers, .player-halo réel, reset explicite repli, color-mix+repli rgba, cache promesses, keyframes desktop centrées, mute réel + aria-valuetext, reset ranges webkit+moz, hints réutilisés + test anti-orphelins, mandat AA ≤ 13 px 17 sites tabulés, assets existants édités, approximation favicon/maskable 50 % actée. 11 étapes, CA en deux exécutions, zéro dépendance.
