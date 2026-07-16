# RetroMultiCiv — the repo IS the app (no build step). This image just brings
# Node, installs the one runtime dependency (ws), copies the source, and runs
# the authoritative server. See docs/how-to-host.md.
FROM node:22-slim

WORKDIR /app

# install deps from the lockfile first so the layer caches across source edits;
# --omit=dev keeps it to `ws` only (there are no runtime devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# the application source (node_modules, saves, git, etc. excluded via .dockerignore)
COPY . .

# game state persists here; mount a volume over it to survive container restarts
VOLUME ["/app/saves"]

EXPOSE 8123

# flags after the image name reach the server, e.g. `docker run … --civs 6`.
# Default is hardened static (client/engine/shared/data only) — never add
# --debug in a published image.
ENTRYPOINT ["node", "server/index.js"]
CMD ["--port", "8123", "--host", "0.0.0.0"]
