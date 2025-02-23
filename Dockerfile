# Dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps

WORKDIR /app

# Установка зависимостей для сборки
RUN apk add --no-cache libc6-compat

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
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner

WORKDIR /app

# Установка необходимых пакетов
RUN apk add --no-cache libc6-compat

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Создаем пользователя для запуска приложения
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем собранные файлы
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Устанавливаем только production зависимости
RUN npm install --omit=dev

# Копируем .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Переключаемся на непривилегированного пользователя
USER nextjs

# Открываем порт
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Запускаем приложение
CMD ["node", "server.js"]
