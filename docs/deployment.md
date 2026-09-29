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


## Вычислительный движок в опубликованном интерфейсе

Cloudflare Worker не запускает `services/simulation/app.py` и не содержит встроенного Python/SimPy. Маршруты `/api/v1/ris/simulate` и `/api/v1/ris/experiment` требуют отдельно развёрнутый Python-сервис с `SIMULATION_ENGINE_URL` и `SIMULATION_SERVICE_KEY` и возвращают 503 без него — это ожидаемая безопасная блокировка, а не результаты моделирования. Основная пользовательская кнопка «Моделирование» теперь направляет на `AgentStudio`, где расчёт выполняется TypeScript Simulation Core и не маркируется как SimPy. Публичный API `/api/v1/agent/study` выполняет тот же тип исследования с ограничением 90 заданий, 15 роботов, 2 часов и 10 прогонов. Не подменять результат SimPy результатом другого движка в legacy-контракте.

Старые браузерные тесты маршрута SimPy сохранены в `tests/legacy/simpy-workflow.legacy.ts` и не входят в обычную проверку публичного UI. Для возвращения SimPy в интерфейс потребуется независимый защищённый Python-хост, доступность с Cloudflare, контроль времени исполнения и отдельная проверка контрактов.
