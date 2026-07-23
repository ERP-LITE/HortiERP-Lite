FROM node:20-alpine AS base
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
