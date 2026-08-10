FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --workspace=apps/web

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

FROM deps AS build
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
