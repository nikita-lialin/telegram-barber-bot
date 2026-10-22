# Этап 1: сборка (нужны devDependencies ради tsc)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Этап 2: запуск (только dist/, data/, locales/, assets/ и prod-зависимости)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY data ./data
COPY locales ./locales
COPY assets ./assets
RUN mkdir -p /app/sessions && chown node:node /app/sessions
# Язык пользователей хранится здесь; монтируйте volume, чтобы он переживал обновления.
ENV SESSION_DIR=/app/sessions
VOLUME /app/sessions
USER node
CMD ["node", "dist/index.js"]
