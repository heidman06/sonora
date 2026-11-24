# CHANGES — Sonora v2.1.0 (lot 0 + lot 1 + échelle + features signature)

> Liste par symbole pour la revue Goldfish finale (le checkout local n'est pas un dépôt git ; la prod heid a été déployée et vérifiée : node:test 30/30, vitest 62/62, smoke 14/14, QA API 54/54, DOM froid ≤ 100, boot offline SW, sweep 18 combos i18n sans fuite FR ni erreur applicative).

## Serveur
- musique.mjs : ouvrirBase (+migrations position & history.duration, backfill unique), fermerBase ✚ (test-only), metaConnue ✚, majMetaAsync ✚, pousseHistory (+duration nullable, dédup 60 s, invalidation statsCache), FILTRE_MIXTE (limites de mots), lancerYtdlp (sémaphore ytPrendre/ytRendre en finally), ytPlaylist (sémaphore + truncated), statsPour ✚ (NULLIF), smartPour ✚, radioSync ✚, radio ✚, radioImmediate ✚, routes /stats /smart/:key (GET-only) /radio /playlists/:id/tracks/bulk /playlists/:id/reorder, GET /playlists/:id & covers ORDER BY (position IS NULL), position, 4 sites d'insertion avec position, POST /history accepte duration, feedback like avec métadonnées + liste auto, likes/playlist durations manquantes plafonnées 60, PIPED_URL ??.
- subsonic.mjs : getSimilarSongs2/getSimilarSongs branchés radioImmediate ; playlistComplete & covers ORDER BY position ; star/scrobble avec metaConnue/majMetaAsync/pousseHistory ; PIPED_URL ?? ; fetch AbortSignal.timeout (requetePiped, getCoverArt).
- audio.mjs : branche HEAD via lancerTelechargement (map partagée, plus de spawn détaché) ; servirFichier utimesSync (LRU honnête).
- hls.mjs : genererSilence nom séparé .silence.ts + TTL 10 min ; index.m3u8 durées réelles via dureesConnues ; servirFichier utimesSync.
- durees.mjs : PIPED_URL ??.
- musique-resolve.mjs : artiste = res.artist || r.artist (plus le titre) ; insertion par tranche dans l'ordre des pending.id ; insPiste avec position.
- index.mjs : proxyPiped AbortSignal.timeout.
- alertes.mjs ✚ : timer 5 min, 3 checks (smoke via systemctl par clé + fraîcheur LastTriggerUSec du timer, cache > 90 %, sonde cookies conditionnelle avec js-runtimes), dédup 6 h + rétabli, état sous SONORA_DATA, headers ntfy ASCII.
- smoke.mjs : check page React-aware + check legacy séparé (14 checks).
- tests : v21.test.mjs ✚ (position/4 sites/bulk/reorder/parité Subsonic/stats/smart/radio/CarPlay), v21b.test.mjs ✚ (idempotence fermerBase, NULLIF, dédup, perf 10k, radio secours).
- docs/systemd/sonora-alertes.{service,timer} ✚ (installés et actifs sur heid).

## Frontend
- audio/engine.ts : IS_IOS exporté ; downloadProgress + lecteur de flux ; stale{playlists,likes} ; sleep/crossfade/rate/swUpdate ; refreshLibrary catch(null)+persistance+stale ; loadPlaylists garde ; setActiveUser pause+reset ; togglePlay index réel ; toggleShuffle Fisher-Yates+preShuffle ; clearQueue/saveQueueAsPlaylist ; setSleep/setCrossfade/setRate/setSwUpdate/seekTo/seekBy/playNextInQueue/enqueue/removeFromPlaylist/startRadio ✚ ; installSleep/installCrossfade câblés (hosts additifs) ; revokeFadeBlob ✚ ; MediaSession seekbackward/seekforward + artwork 480x360 ; toasts via tr ; authError via tr. Zéro diff interne : bindMedia/startHls/startDirect/armStall/onMediaError/prefetchNext/playMedia/unlock/updatePositionState.
- audio/sleep.ts ✚, audio/crossfade.ts ✚ (+tests) : temps relatif via getSnapshot, filet ended capture, rampe égal-power, abandon, révocation blob.
- audio/usePlayer.ts : usePlayerSelector (cache d'égalité, getSnapshot stable), selectUiState, UiState.
- lib/selector.ts ✚ (+test), lib/time.ts ✚ (+test), lib/normalize.ts ✚ (+test), lib/export.ts ✚ (+test), lib/img.ts ✚ (artOf maxres→mq same-origin), lib/lrc.ts ✚ (+test), lib/lyrics.ts ✚ (+test), lib/sw.ts ✚, lib/i18n.ts (clés ×3 + DICTS exporté), lib/i18n.test.ts ✚ (keysets, usages, littéraux, ternaires, copies EN→ES), lib/idb.ts (v2 store lyrics, onblocked+timeout+reset), lib/api.ts (thumbOf same-origin, cleanArtist, ytPlaylist public+truncated, bulkAddToPlaylist, reorderPlaylist, stats, smart, radio, pushHistory duration), lib/hooks.ts (routes liked/smart/stats, useScrollMemory JSON {scrollTop,batchCount}, useMediaQuery à venir refonte).
- components/TrackRow.tsx : memo, prop lang, data-action/data-id/data-index absolu, zéro closure ; Art ; égaliseur.
- components/TrackList.tsx ✚ : délégation 3 handlers stables, lots 100, rehydratation rAF 2 lots/frame, persistance scroll+batchCount.
- components/Art.tsx ✚ (maxres→mq), ConfirmDialog.tsx ✚ (alertdialog, focus, Escape, Tab), UndoToast.tsx ✚ (5 s), ActionSheet.tsx ✚ (lire ensuite/file/playlist/radio), ImportSheet.tsx ✚ (aperçu+truncated+compensation), LyricsPanel.tsx ✚ (ligne active, tap=seekTo, instrumental/absent), SleepPicker.tsx ✚, RatePicker.tsx ✚, UpdateBanner.tsx ✚ (disabled en lecture), Icon.tsx (+dots).
- components/PlayerSheet.tsx : UiState + sélecteurs progression/volume, seek au relâchement, volume masqué iOS, panneaux paroles/sleep/vitesse, bouton radio, % download.
- components/DesktopPlayer.tsx : UiState + sélecteurs, repeat/shuffle/add/download, ±10 s, RatePicker.
- components/MiniPlayer.tsx, QueueSheet.tsx (outils vider/enregistrer, tr), AddSheet.tsx (track arbitraire), DesktopSidebar.tsx : UiState.
- views/HomeView.tsx (Art, skeletons recos, seeds traduits), SearchView.tsx (TrackList, erreur≠vide+retry, menu), LibraryView.tsx (réordonnée, carte likés, smart chips, import, ConfirmDialog, crossfade, reset SW, stale banner), PlaylistView.tsx (rename inline, retrait+undo compensation, export M3U/JSON, ConfirmDialog, back), ArtistView.tsx (TrackList, radio, back), LikedView.tsx ✚ (filtre complet avant lots, shuffle), SmartView.tsx ✚, StatsView.tsx ✚.
- App.tsx : usePlayerSelector(selectUiState), routes liked/smart/stats, ActionSheet/AddSheet généralisé, UpdateBanner, registerSw, Shift+Arrows ±10 s, Espace sans hijack des boutons, toast aria-live, bandeau session.
- public/sw.js ✚ : app-shell network-first HTML / cache-first assets, API/audio jamais interceptés, versionnage par hashes, SKIP_WAITING à la demande.
- assets polices Inter OFL ✚ (inter-latin.woff2 48 256 o, inter-latin-ext.woff2 85 068 o, OFL-Inter.txt), public/favicon.svg ✚, public/icon-maskable-512.png ✚ (consommés par la refonte v2.2).
- frontend/package.json : version 2.1.0 (deps inchangées).

## Prod heid
- dashboard/{musique,subsonic,durees,audio-inline via server.mjs,hls,musique-resolve,alertes,sonora-smoke}.mjs déployés avec sauvegardes .bak-lot0-*/.bak-v21-* ; server.mjs : HEAD via map + utimesSync ; public/musique = bundle React v2.1.0 + sw.js ; qa/api.py mis à jour React-aware (54 checks) ; timer sonora-alertes actif.