# ---- 1. Сборка мини-приложения (React + Vite) ----
FROM node:24.21.0-alpine3.24 AS miniapp
WORKDIR /build
COPY miniapp/package.json miniapp/package-lock.json ./
# Install-скрипты зависимостей не нужны: бинарник esbuild приходит отдельным пакетом под платформу.
RUN npm ci --ignore-scripts
COPY miniapp/ ./
# Планировщик вечера общий с сервером: мини-приложение импортирует его как ../../../shared (см. miniapp/src/lib/planner.js).
COPY shared/ /shared/
# Ник бота попадает в ссылки-приглашения (https://max.ru/<ник>?startapp=…) при сборке.
ARG VITE_BOT_NAME=""
ENV VITE_BOT_NAME=$VITE_BOT_NAME
RUN npm run build

# ---- 2. Сервис: бот MAX + раздача мини-приложения ----
FROM node:24.21.0-alpine3.24
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY shared ./shared
COPY data ./data
# Корневой сертификат Минцифры: без него Node не доверяет сертификату MAX (см. README).
COPY certs ./certs
COPY --from=miniapp /build/dist ./miniapp/dist

# Состояние бота (диалоги, напоминания, позиция long polling) лежит в томе: compose монтирует его
# сюда, и оно переживает пересоздание контейнера. Папка принадлежит node, под которым работает бот.
ENV STATE_FILE=/app/state/state.json
RUN mkdir -p /app/state && chown node:node /app/state

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "src/index.js"]
