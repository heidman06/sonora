# Sonora frontend (React + Vite + TypeScript)

This is the next-generation web client. It is served in parallel at **/musique-next/** until feature parity is verified; the legacy client remains at **/musique/**.

## Stack
- React 19 + TypeScript strict
- Vite 7
- No server-side rendering, no Next.js
- Audio is handled by an imperative `PlayerEngine` (`src/audio/engine.ts`) with HLS on iOS, server audio on other platforms and IndexedDB offline downloads

## Development
```bash
npm install
npm run dev          # http://127.0.0.1:5174/musique-next/
npm run typecheck
npm run build
```

The dev server proxies `/api`, `/musique/dl` and `/musique/hls` to the production hub; override with `VITE_PROXY_TARGET`.

## Migration status
- [x] App shell, tabs, theme, language (FR/EN/ES)
- [x] Multi-account login/register/logout/switch
- [x] Home: Daily Mixes, For You, recent, playlists, moods
- [x] Search (songs/videos/albums/artists, suggestions, load more)
- [x] Library, favorites, downloads, playlists
- [x] Playlist and artist pages
- [x] Player, queue, seek, volume, repeat/shuffle, MediaSession
- [x] Offline downloads (IndexedDB)
- [x] Queue reorder/remove
- [ ] Full visual parity on all breakpoints
- [x] Queue reorder/remove and download removal
- [ ] Production switch from /musique/ to React client
