# RIS Agent Studio

Веб-сервис предпроектной оценки роботизации с каталогом оборудования, агентной симуляцией технологических операций и расчётом экономики внедрения.

## Требования

- Node.js 24+, npm и Git.
- Для локальной работы встроенного Simulation Core Python не требуется.
- Для дополнительных расчётов через SimPy: Python 3.11+ и зависимости из `services/simulation/requirements.txt`.

## Локальный запуск

```bash
git clone https://github.com/CrazyEther/robotization-agent-lab.git
cd robotization-agent-lab
npm ci
npm run dev
```

Открыть http://127.0.0.1:5173. API: http://127.0.0.1:8787. В интерфейсе выбрать «Моделирование» для запуска встроенного агентного ядра. Эксперименты через устаревший маршрут `/api/v1/ris/experiment` требуют отдельной настройки SimPy; основной сценарий работает через `/api/v1/agent/study`.

## Тесты и сборка

```bash
npm run typecheck
npm test
npm run build
```

## Развёртывание на Cloudflare Workers

Авторизоваться в Cloudflare CLI, затем выполнить из корня репозитория:

```bash
npm run build
npx wrangler deploy
```

Конфигурация Worker: `wrangler.jsonc`; имя сервиса: `ris-agent-studio-2026`. Демонстрация: https://ris-agent-studio-2026.battle-walleye.workers.dev. Встроенный агентный движок выполняется непосредственно на Worker в пределах опубликованных лимитов. Для отдельного Python API SimPy потребуется самостоятельный хост и секреты `SIMULATION_ENGINE_URL`, `SIMULATION_SERVICE_KEY`; не публикуйте секреты в Git.

## Каталог и данные

- `data/catalog.json` — справочные карточки с атрибутами и ссылками.
- `data/catalog-v4.json` — 223 записи CSV (187 уникальных ID), включая описания, сценарии, цены и кейсы из предоставленной выгрузки.
- `data/evidence/sources.json` — реестр URL первичных источников.
- `data/evidence/verified_claims.json` — атрибутированные технические сведения, ценовые предложения и кейсы; статусы конфликтов и запреты на применение в расчётах сохраняются.
- `data/evidence/supplement_products_v2.json` — дополнительные паспорта Aethon T3 и TLD EZTow.
- `scripts/import-catalog-v4.mjs` — воспроизводимый импорт исходного CSV без домысливания валют и подтверждения цен.

Не подставляйте цены из CSV в ROI без уточнения валюты и условий закупки. Паспортный максимум скорости не равен фактической рабочей скорости. Параметры со статусом `blocked` или `source_conflict` не должны использоваться автоматически.

## API и документация

`GET /api/v1/agent/health` — возможности и лимиты; `POST /api/v1/agent/study` — агентное исследование; `GET /api/v1/catalog` и `GET /api/v1/catalog/v4` — каталоги.

Дополнительно: [архитектура](docs/ARCHITECTURE.md), [API](docs/API.md), [развёртывание](docs/deployment.md), [ограничения](docs/ACCEPTANCE.md), [презентация](public/RIS_Agent_Studio_Presentation.pdf).

## Границы модели

Проект даёт предварительную оценку. Это не сертифицированный цифровой двойник: отсутствуют SLAM, полноценная многоэтажная физика, промышленная интеграция с WMS/MES и калибровка по данным конкретного объекта. Инженерные выводы требуют проверки исходных данных и параметров объекта.

## Демо-ветка с редактируемой планировкой и обновлённым каталогом

Редактор планировки, изменения каталога и условные финансовые сценарии проходят проверку в отдельной ветке `preview/editable-facility`. Для точного воспроизведения **[тестового сайта](https://ris-layout-lab-2026.battle-walleye.workers.dev/?preview=layout)** локально:

```bash
git clone --branch preview/editable-facility --single-branch https://github.com/CrazyEther/robotization-agent-lab.git
cd robotization-agent-lab
npm ci
npm run dev
```

Сайт на отдельном Cloudflare Worker публикуется этой же веткой командой `npm run build && npx wrangler deploy --config wrangler.preview.jsonc`. Для самостоятельного развёртывания задайте уникальное имя Worker в конфигурации. Все актуальные данные каталога находятся в репозитории и в сборке; внешние снимки чужих сайтов не нужны для запуска. Сведения о методике источников см. [research/README.md](research/README.md).
