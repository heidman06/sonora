# CarPlay with Amperfy - test guide

Sonora exposes a Subsonic gateway at /subsonic/rest. Amperfy (free on the App Store, CarPlay support) can browse and play Sonora content.

## Requirements

- iPhone with network access to your Sonora instance (VPN/tailnet if private)
- Amperfy installed (iOS 16+)
- Sonora reachable over HTTPS

## Setup

1. Amperfy -> Add Server -> type Subsonic
2. URL: https://your-domain.tld/subsonic
3. Username and password: your Sonora account
4. Enable legacy login (Amperfy 1.0.7+)
5. Optional: define SONORA_SONIC_USERS on the server for MD5 token auth

## What should appear

- Playlists: Sonora playlists (mapped to Subsonic albums)
- Albums: the same lists sorted by date
- Artists: a Sonora artist containing those albums
- Favorites: liked tracks (getStarred2)
- Search: YouTube search through yt-dlp (10 results)
- Playback: m4a stream via /musique/dl/, artwork, background and CarPlay audio

## Known limitations

- Albums are derived from playlists (no separate album metadata)
- Durations are filled in the background; the first opening may show 0:00, later visits show real durations
- Podcasts, radios and genres are empty (not managed by Sonora)
- First play of a track can take a few seconds (server extraction), then cached
- Real car head-unit validation is still pending

## Troubleshooting

- Error 40 Wrong username or password: check credentials and legacy login mode.
- Empty screen after login: ping must respond; verify the exact /subsonic URL.
- Missing artwork: getCoverArt proxies i.ytimg.com; verify outbound network access.
- Stream does not start: test /subsonic/rest/stream.view?...&id=VIDEOID; it must return 302.
- CarPlay does not show Amperfy: allow Amperfy in Settings -> General -> CarPlay.

## Command-line checks

    B=https://your-domain.tld/subsonic/rest
    curl -s "$B/ping.view?u=USER&p=PASSWORD&v=1.16.1&c=test&f=json"
    curl -s "$B/getPlaylists.view?u=USER&p=PASSWORD&v=1.16.1&c=test&f=json"
    curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$B/stream.view?u=USER&p=PASSWORD&v=1.16.1&c=test&id=VIDEOID"
