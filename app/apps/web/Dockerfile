# Многостадийная сборка: target dev — для docker-compose, target runner — для Timeweb Cloud App Platform.
# Build context на App Platform: app/apps/web (см. new/spec/06-implementation-plan.md, Этап 9).

FROM node:22-alpine AS base
WORKDIR /srv

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /srv/public ./public
COPY --from=builder --chown=nextjs:nodejs /srv/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /srv/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
