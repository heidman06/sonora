FROM node:24-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:24-bookworm-slim

# Outils audio : yt-dlp (binaire) + ffmpeg pour le faststart
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg python3 \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY web ./web
COPY --from=frontend /frontend/dist ./web-next

RUN useradd -r -u 10001 -m sonora \
  && mkdir -p /data \
  && chown -R sonora:sonora /app /data

USER sonora
ENV SONORA_HOST=0.0.0.0 \
    SONORA_PORT=3011 \
    SONORA_DATA=/data \
    SONORA_NODE_BIN=/usr/local/bin/node \
    YTDLP_PATH=/usr/local/bin/yt-dlp \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    SONORA_WEB_NEXT=/app/web-next

VOLUME ["/data"]
EXPOSE 3011

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3011/api/mus/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
