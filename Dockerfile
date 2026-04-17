FROM node:22-alpine AS build

WORKDIR /app
ARG DATABASE_PROVIDER=postgresql
ENV DATABASE_PROVIDER=$DATABASE_PROVIDER
ENV DATABASE_URL=postgresql://randomcron:randomcron@localhost:5432/randomcron

COPY package*.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts components.json ./
COPY prisma ./prisma
COPY src ./src
COPY frontend ./frontend
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV DATABASE_PROVIDER=postgresql
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

USER node

CMD ["node", "dist/index.js"]
