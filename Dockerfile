# Dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps

WORKDIR /app

# Установка зависимостей для сборки
RUN apk add --no-cache libc6-compat python3 make g++

# Копируем файлы для установки зависимостей
COPY package.json ./

# Устанавливаем зависимости
RUN npm install

# Stage 2: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем зависимости и исходный код
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Отключаем телеметрию Next.js и собираем приложение
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Генерируем production build
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner

WORKDIR /app

# Установка необходимых пакетов
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Создаем пользователя для запуска приложения
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копируем собранные файлы
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Устанавливаем только production зависимости
RUN npm install --omit=dev

# Переключаемся на непривилегированного пользователя
USER nextjs

# Открываем порт
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Запускаем приложение
CMD ["node", "server.js"]
