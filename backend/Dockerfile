FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
COPY prisma ./prisma
COPY prisma7.config.ts ./prisma7.config.ts
RUN npm ci

FROM base AS build
COPY backend ./backend
COPY prisma ./prisma
RUN npm --workspace backend exec prisma generate -- --schema ../prisma/schema.prisma && npm run build --workspace backend

FROM node:22-alpine AS runtime-deps
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
COPY prisma ./prisma
COPY prisma7.config.ts ./prisma7.config.ts
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=runtime-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma7.config.ts ./prisma7.config.ts
USER node
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node backend/dist/server.js"]
