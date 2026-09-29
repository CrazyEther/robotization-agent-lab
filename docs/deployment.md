# Независимое развёртывание

## Архитектура исполнения

Текущий внешний сервис — Cloudflare Worker `ris-agent-studio-2026` с Hono backend и Vite static assets. Используются отдельная рабочая папка, отдельная конфигурация и отдельное имя Worker. Никакой автоматической синхронизации с `robotization-platform` нет.

## Локально

Node.js 24+, `npm ci`, `npm run dev`, `npm run build`, `npm test`. Стандартный Hono API доступен по 8787, Vite UI по 5173. Переменные и секреты `.env` не публиковать.

## Cloudflare

Нужен авторизованный `wrangler` и аккаунт с созданным поддоменом `workers.dev`. Из корня новой папки:

```bash
npm run build
npx wrangler deploy
```

Файл `wrangler.jsonc` содержит имя **нового Worker**; не заменяйте его на `robotization-platform`. При нескольких Cloudflare аккаунтах задайте `CLOUDFLARE_ACCOUNT_ID` локально в окружении, не пишите секретные токены в README. Для проверки: `GET /api/v1/agent/health`, затем POST исследования, затем открыть интерфейс.

## GitHub (самостоятельное независимое дерево)

Код публикуется в **новом** публичном репозитории [CrazyEther/robotization-agent-lab](https://github.com/CrazyEther/robotization-agent-lab). Git remote исходного проекта не является `origin` новой площадки. Для локального клонирования:

```bash
git clone https://github.com/CrazyEther/robotization-agent-lab.git
cd robotization-agent-lab
npm ci
npm run build
```

Новый репозиторий не зависит от исходной истории публикаций, а старая площадка `robotization-platform` остаётся без изменений.

## Управление качеством

`npm run typecheck`, `npm test`, HTTP-проверка `agent/health`, испытания реального 2D-replay в браузере, детерминированный regression test смены производительности при изменении длительности станка. Перед использованием реального каталога валидировать источники и доступность в конкретном регионе.

Конфиденциальные планы предприятия не загружайте в публичный демонстрационный сервис без отдельной модели хранения, контроля доступа и политики данных.
