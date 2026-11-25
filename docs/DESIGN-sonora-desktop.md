# DESIGN v2 — Sonora desktop (CSS seul, append-only)

Cible unique : _repos/sonora/frontend/src/overrides.css (bloc appendé après L315 ; L1–315 intactes). Desktop = 1000px (aligné sur overrides.css:32). ≥1500 intact.

## Tranches
- Abandonnés après critique : mesure 1160 (no-op), masquage des actions au hover (cache l'état aimé), scrollbars forcées, grille player.
- Player : MQ (1000–1499.98) .dp-track flex:0 1 250px;min-width:0 ; .dp-center min-width:232px ; .dp-tools width:auto. Sous-MQ ≤1199.98 : .dp-vol display:none (volume reste dans #player .vol). Arithmétique : dispo = W−371 ; dp-controls 232 ; dp-tools 286 sans vol (394 avec) ; à 1000/1024/1200/1440 pas d'overflow.
- Headings : .top.scrolled #headings{display:block} (1,2,0, gagne par ordre) — le repli compact app.css:625-628 reste actif.
- Grilles : .grid auto-fill minmax(200px,1fr) ; .grid .card width:auto ; .grid .card-art-wrap width/height:auto (aspect-ratio 1 conservé). .grid.three inchangé.
- Transitions : .card-art transition .18s (bat .6s par ordre).
- Light : hover .dp-icon/.dp-btn/.side-link/.side-playlist via var(--surface-2) (0,3,0).
- Reduced-motion (≥1000) : .card:hover/.card:active .card-art/.track:active transform:none.
- Focus : border-radius au focus = rayon de repos (50 % boutons ronds, 20 carte, 18 piste, 12 actions, 22 pl-card).
- Divers : .searchbar max-width 640 ; .pl-empty padding 64px 0.

## AC mesurables
A1 overflow (1000/1024/1200/1440) ; A2 ≥1500 dp-track/dp-tools = 290 ; A3 headings display block ≥1000 après scroll, none à 699, CLS < 0.1 ; A4 .grid 3 col à 1000 / 5 à 1440 ; A5 reduce -> transform none, transition ≤.2s ; A6 focus radius correct, anneau accent 5.3:1 ; A7 mobile 375/699 diff 0 (scoping ≥1000) ; A8 zoom 200 % inactive la couche, 700–999 diff 0.

## Risques
Scrollbar supposée 15px (overlay 0 -> marges accrues, jamais d'overflow). Track 111px à 1000 (ellipsis accepté). Volume masqué 1000–1199, réversible en 1 règle.
