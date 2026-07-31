FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspace=apps/api

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3333
CMD ["npm", "run", "dev"]

FROM deps AS build
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nodejs && adduser -S hortierp -G nodejs
COPY --from=build --chown=hortierp:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=hortierp:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=hortierp:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=hortierp:nodejs /app/apps/api/src/db/migrations ./apps/api/src/db/migrations
WORKDIR /app/apps/api
USER hortierp
EXPOSE 3333
CMD ["node", "dist/server.js"]
