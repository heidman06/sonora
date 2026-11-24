# Gate A1.0 / S0-b / B5 / S11 — décision argumentée (surrogate)

**Protocole** : desktop Chrome headless, viewport 390×844 @2x, CPU throttling ×4 pour A1.0 ; mesures S11 sans throttling sur la prod v2.2.2. **NON VÉRIFIÉ MOBILE RÉEL** : aucun téléphone mi-gamme ni iPhone disponible dans la session ; une passe appareil réel est requise avant release publique (design échelle §N5, design features §F2/F3, LIMITATIONS.md).

**Baseline S0-b (avant crossfade/refonte)** : 3 runs pointerup→playing = 775 / 299 / 587 ms, médiane 587 ms (< 4 s). Le crossfade (défaut off) et la refonte n'ajoutent aucun travail avant le premier timeupdate ; médiane post-refonte mesurée identique en ordre de grandeur (démarrage cache ~8 ms, froid ~4 s côté serveur yt-dlp, hors responsabilité client).

**Gate A1.0 (surrogate throttlé ×4, 60 s lecture + 10 s scroll)** : 0 longtask > 100 ms ; frame médian 16,7 ms ≤ 25 ms ⇒ jank NON confirmé sur le surrogate. Conformément à §N5 (seuil symétrique), A1a/A1b étaient annulables ; le tie-break documenté (App consommait le snapshot complet à 4 Hz avant le sélecteur) et le fait structurel F1/F3 ont justifié de conserver le socle : S0 (TrackList/DOM ≤ 100) est non annulable, et le sélecteur à cache d'égalité est conservé avec la mention « non vérifié mobile réel ».

**Mesures S11 (prod v2.2.2, deux passes A/B via reload)** :
- DOM .track à froid : #/library = 20 sur la session mesurée (favoris 20 + téléchargements 0) ; borne structurelle 40 (20 + batchSize 20) < 100, #/liked = 100 ; retour 10 lots ≤ 1000 (rehydratation rAF 2 lots/frame, scroll restauré après commit).
- Panneau #np-panel : présent à 1600 (48 éléments ≤ 52), absent à 1440.
- EmptyState : 7 nœuds ≤ 10 (likés vide, invité).
- Extraction palette : mesurée en lecture (voir gate-brut.json paletteMs) ≤ 8 ms ; halo --dyn-* suit la pochette ; repli null → INITIAL vérifié par test unitaire + computed.
- 0 longtask > 100 ms sur 60 s de lecture ; frame médian 16,7 ms sur 10 s de scroll.
- Offline : boot PWA après mode avion = true ; document.fonts.check('16px InterVariable') = true (woff2 précaché par le SW) ; transférés FR/EN/ES = 48 256 o (latin seul, unicode-range).
- prefers-reduced-motion : opacité des lignes = 1 à t0 ; fermeture timer 0 ms ; burst non monté.
- i18n : sweep 18 combos (2 comptes × 3 langues × 3 routes) sans fuite FR ; les SecurityError localStorage observés sont un artefact du script d'injection CDP sur about:blank (invité sans injection = 0 exception).
- Gates : tsc 0 erreur ; vitest 79/79 ; node:test 32/32 ; smoke prod 14/14 ; QA API 54/54.

**Décision** : livrer v2.2.2 avec la mention « non vérifié mobile réel » ; passe appareil réel (iOS HLS/CarPlay/Android verrouillé) planifiée avant release publique, bloquante pour livrer au public, pas pour le déploiement tailnet actuel.
