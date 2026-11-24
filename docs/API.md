# API musique (Sonora) — contrat

> Version 1.1 — 2026-11-24. Toute évolution doit mettre à jour ce fichier **et** le playbook (~/SONORA-PLAYBOOK.md).

Base : `https://votre-domaine.tld:8451/api/mus`
Auth : `Authorization: Bearer <token>` (obtenu via /login). Les données sont **séparées par compte**.

## Comptes
| utilisateur | mot de passe |
|---|---|
| maria | (voir `dashboard/data/musique-users.txt`) |
| heid  | (voir `dashboard/data/musique-users.txt`) |

## Routes
```
GET  /health                                   -> {ok,version,users,playlists,tracks,likes,history,pending,recos_cached,recos_age_s}   # public
POST /login            {username,password}      -> {token,user}
POST /register         {username,password}      -> {token,user}          # 3-24 a-z0-9._-, mot de passe >= 8
POST /logout                                    -> {ok}   # révoque le token courant
POST /feedback         {videoId,action}          -> {ok}   # action: dismiss | like (recos/mix)
GET  /feedback                                   -> [{video_id,action,at}]
GET  /me                                        -> {user}
GET  /playlists                                 -> [{id,name,count,cover[]}]
POST /playlists        {name}                   -> {id,name,count,cover}
GET  /playlists/:id                             -> {id,name,tracks[{videoId,title,artist,duration}]}
PATCH  /playlists/:id  {name}                   -> {ok}
DELETE /playlists/:id                           -> {ok}        # suppression
POST /playlists/:id/tracks {videoId|title+artist} -> {ok,videoId,title,artist}   # ajout
DELETE /playlists/:id/tracks/:videoId           -> {ok}        # retrait
GET  /likes                                     -> [{videoId,title,artist,duration}]
POST /likes            {videoId|title+artist}   -> {ok,videoId}  # ajouter aux likés
DELETE /likes/:videoId                          -> {ok}
GET  /history?n=50                              -> [{videoId,title,artist,at,duration}]
POST /history          {videoId,title,artist}   -> {ok}
GET  /recos?n=20                                -> [{videoId,title,artist,seed,duration,source}] # recommandations
GET  /mix?n=30                                  -> [{videoId,title,artist,seed,duration,source}] # mix radio (30 max)
GET  /mixes                                     -> [{key,name,subtitle,count,cover[],tracks[]}] # 3 daily mixes
GET  /resolve?title=&artist=                    -> {video_id,title,artist}
GET  /pending                                   -> {reste}      # titres Spotify en cours de résolution
```

## Notes
- `videoId` : identifiant YouTube (11 caractères). Si absent, le serveur résout via `title`+`artist`.
- Durées : table track_meta, remplie en fond via Piped (module durees.mjs partagé ; timer resolve : 120/min sur playlists + likes + historique) ; renvoyées par playlists/likes/historique et Subsonic.
- Lecture audio : `GET /musique/dl/:videoId` (streaming progressif + cache ; Range 206 ; marqueur `.ok`).
- **Recos v3** : deux sources — (1) **titres liés Piped** (`/streams/<id>`) pour 3 graines issues de l'historique/likes, (2) affinités = likes ×2 + historique pondéré (×1,6 sur 14 j, ×1 sur 60 j, ×0,5 au-delà) + playlists ×0,4 → top 8 artistes, `ytsearch10` chacune. Filtres durée 60-600 s et titres parasites (mix, slowed, reverb, nightcore, 8d…), déduplication likes/playlists/60 dernières écoutes.
  Cache SQLite `reco_cache` 3 h par utilisateur, **versionné (v=4) pour invalider les anciens résultats**, **stale-while-revalidate** : la réponse est immédiate (cache ou secours likes/historique), le calcul tourne en tâche de fond. Max 40 titres stockés.
- **Feedback recos** : `dismiss` exclut définitivement le titre des recos/Mix/Daily Mix ; `like` ajoute aux favoris. Invalide le cache recos du compte.
- **Daily Mixes** : 3 mix (Découvertes / En boucle / Tes favoris), 20 titres chacun, cache 45 min, invalidés au recalcul des recos.
- **Mix** : 50 % découvertes recos + 25 % likes + 15 % historique + 10 % playlists, dédupliqué et mélangé ; cache mémoire 45 min par compte, invalidé quand les recos sont recalculées. Jamais vide (repli sur les favoris/historique).
- Concurrence yt-dlp limitée à 2 recherches simultanées pour les recos.
- Résolution des imports Spotify : timer `heid-musique-resolve.timer` (30 titres / 2 min).
- `/health` ne requiert pas de token et ne renvoie aucune donnée personnelle.
- Sessions : TTL **30 jours** (configurable `SONORA_SESSION_DAYS`), nettoyage des sessions expirées au login, maximum 20 sessions par compte ; `POST /logout` révoque le token côté serveur.

## Smoke test
`/usr/local/bin/heid-node server/smoke.mjs` — 13 vérifications (page, health, login, playlists, likes, historique, recos, mix, Range audio, intégrité SQLite). Code de sortie 0 = OK. Timer systemd `heid-sonora-smoke.timer` toutes les 15 min.


## Passerelle Subsonic (CarPlay)

Base : `/subsonic/rest` (compatible Amperfy). Auth **legacy** : `u` + `p` (plain ou `enc:hex`).
Auth token MD5 (`u`+`t`+`s`) si `SONORA_SONIC_USERS="user:password"` est défini.

Durées : `track_meta` rempli en tâche de fond via Piped `/streams` ; la première ouverture d'un album peut afficher 0:00, les suivantes ont les durées réelles.

Endpoints : `ping`, `getLicense`, `getMusicFolders`, `getPlaylists`, `getPlaylist`, `search3`, `getCoverArt`, `stream` (302 → `/musique/dl/`), `getStarred2`, `star/unstar`, `scrobble`, `getRandomSongs`, `getUser`, `getScanStatus`, `getAlbumList2` (vide), `getArtists/getIndexes` (vide).
JSON si `f=json` (ou `Accept: application/json`), sinon XML.

Exemple :
```
GET /subsonic/rest/ping.view?u=heid&p=MOTDEPASSE&v=1.16.1&c=amperfy&f=json
GET /subsonic/rest/getPlaylists.view?u=heid&p=MOTDEPASSE&v=1.16.1&c=amperfy&f=json
GET /subsonic/rest/stream.view?u=heid&p=MOTDEPASSE&v=1.16.1&c=amperfy&id=VIDEOID
```
