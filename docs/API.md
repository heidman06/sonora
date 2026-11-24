# Sonora API contract

Base URL: /api/mus
Auth: Authorization: Bearer <token> (from /login). Data is strictly separated per account.
Accounts are defined in the server data directory (musique-users.txt, chmod 600).

## Routes

    GET  /health                              public status: version, counts, recos cache
    POST /login            {username,password} -> {token,user}
    POST /register         {username,password} -> {token,user}
    POST /logout                              -> {ok} (revokes current token)
    GET  /me                                  -> {user}

    GET  /playlists                           -> [{id,name,count,cover[]}]
    POST /playlists        {name}             -> {id,name,count,cover}
    GET  /playlists/:id                       -> {id,name,tracks[{videoId,title,artist,duration}]}
    PATCH /playlists/:id   {name}             -> {ok}
    DELETE /playlists/:id                     -> {ok}
    POST /playlists/:id/tracks {videoId|title+artist} -> {ok,videoId,title,artist}
    DELETE /playlists/:id/tracks/:videoId     -> {ok}

    GET  /likes                               -> [{videoId,title,artist,duration}]
    POST /likes            {videoId|title+artist} -> {ok,videoId}
    DELETE /likes/:videoId                    -> {ok}

    GET  /history?n=50                        -> [{videoId,title,artist,at,duration}]
    POST /history          {videoId,title,artist} -> {ok}

    GET  /recos?n=20                          -> recommendation items
    GET  /mix?n=30                            -> Mix radio items
    GET  /mixes                               -> 3 daily mixes
    POST /feedback         {videoId,action}   -> {ok} (action: dismiss|like)
    GET  /feedback                            -> [{video_id,action,at}]

    GET  /resolve?title=&artist=              -> {video_id,title,artist}
    GET  /pending                             -> {reste}

    GET  /musique/dl/:videoId                 -> audio stream / Range 206
    GET  /musique/hls/index.m3u8?ids=&durs=    -> HLS queue playlist (iOS background)
    GET  /musique/hls/seg/:videoId.ts         -> HLS audio segment (generated on demand)

## Notes

- videoId is a YouTube 11-character ID. If missing, the server resolves it with title and artist.
- Durations come from the track_meta table, filled in the background via Piped (shared durees.mjs module, 120/min by the resolver timer). They are returned by playlists, likes, history and Subsonic.
- Recommendations v3 uses two sources: Piped related streams for 3 recent seeds, and weighted artist affinities from likes/history/playlists. Durations are filtered to 60-600 s; slowed/reverb/nightcore/mix titles are excluded. Cache: SQLite, versioned, 3 h, stale-while-revalidate.
- Mix: 50% discoveries, 25% likes, 15% history, 10% playlists; deduplicated, cached 45 min. Daily Mixes: Discoveries / On repeat / Favorites, 20 tracks each.
- Feedback dismiss removes a track from recos, Mix and Daily Mixes and invalidates the recos cache.
- Input validation: n parameters are clamped (history 1-200, recos 1-50, mix 1-60); titles/artists are capped at 300 characters; playlist names at 80.
- Sessions: 30-day TTL (SONORA_SESSION_DAYS), maximum 20 per account, revoked by POST /logout.

## Subsonic gateway (CarPlay)

Base URL: /subsonic/rest. Legacy auth: u + p (plain or enc:hex). Optional MD5 token auth when SONORA_SONIC_USERS="user:password" is set.

Endpoints: ping, getLicense, getMusicFolders, getPlaylists, getPlaylist, getAlbumList2, getAlbum, getArtists, getArtist, getMusicDirectory, search3, getCoverArt, stream (302 to /musique/dl/), getStarred2, star/unstar, scrobble, getRandomSongs, getSong, getGenres, getOpenSubsonicExtensions, getPodcasts, getNewestPodcasts, getInternetRadioStations, getUser, getScanStatus.

JSON is returned when f=json (or Accept: application/json), otherwise XML.

## Smoke test

    /usr/local/bin/heid-node dashboard/sonora-smoke.mjs

13 checks: page, health, login, playlist list/detail, likes, history, recos, mix, audio Range 206, SQLite integrity. Exit code 0 means OK.
