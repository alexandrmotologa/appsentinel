# Multi-stage Docker build for AppSentinel
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY bin ./bin
COPY examples ./examples

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3456/healthz || exit 1

ENTRYPOINT ["node", "bin/appsentinel.js"]
CMD ["monitor", "--config", "/app/apps.config.json"]
