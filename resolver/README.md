# Sonora resolver (sidecar InnerTube)

Petit service local (127.0.0.1:8090) qui résout l'URL audio m4a d'une vidéo YouTube via
InnerTube (youtubei.js), en ~0,9 s, sans passer par yt-dlp.

- Cookie YouTube : même fichier que le hub (`data/yt-cookies.txt`).
- Cache mémoire 5 h (200 entrées), clients IOS puis ANDROID.
- Utilisé par `server/resolve-url.mjs` : le hub tente d'abord le sidecar, puis retombe sur yt-dlp.
- Indépendant du dépôt principal (ses propres dépendances npm), donc aucun paquet ajouté à l'app.

## Installation (Raspberry/mini-PC Linux)

```bash
mkdir -p ~/resolver && cd ~/resolver
# copier package.json et server.mjs
npm i --omit=dev
sudo cp sonora-resolver.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sonora-resolver
curl -s http://127.0.0.1:8090/health   # {"ok":true,...}
```

Port par défaut 8090 (`RESOLVER_PORT`), cookies via `SONORA_COOKIES`.
Côté hub : `SONORA_RESOLVER_URL` (défaut `http://127.0.0.1:8090`).
