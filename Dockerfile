# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY App.tsx index.ts app.json tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY resources/ ./resources/
COPY public/ ./public/
RUN npm run build:web

FROM node:24-bookworm-slim AS runtime
LABEL org.opencontainers.image.title="English Desk" \
      org.opencontainers.image.description="Personal English study notebook" \
      org.opencontainers.image.source="https://github.com/Teknoloji-Filozoflari/English-Desk"
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    ENGLISH_DESK_BIND_ADDRESS=0.0.0.0 \
    ENGLISH_DESK_LISTEN_PORT=8081 \
    ENGLISH_DESK_PUBLIC_ORIGINS=http://127.0.0.1:8081,http://localhost:8081
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/scripts/ ./scripts/
COPY --from=build /app/resources/ ./resources/
COPY --from=build /app/src/ ./src/
RUN mkdir -p /app/data /app/.runtime /app/.venv && chown -R node:node /app/data /app/.runtime /app/.venv
USER node
EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "scripts/docker-healthcheck.mjs"]
CMD ["node", "--use-system-ca", "scripts/serve.mjs"]
