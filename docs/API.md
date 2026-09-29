# API RIS Agent Studio

Публичный Cloudflare Worker: `https://ris-agent-studio-2026.battle-walleye.workers.dev`.

## `GET /api/v1/agent/health`

Возвращает `status`, название вычислительного ядра, поддерживаемые механизмы и лимиты публичного демо.

## `POST /api/v1/agent/study`

Content-Type: `application/json`. Тело:

```json
{
  "input": {
    "sector": "warehouse",
    "layout": {"width":20,"height":15,"pickup":{"x":2,"y":2},"dropoff":{"x":17,"y":12},"obstacles":[]},
    "workload":{"demandPerHour":6,"loadKg":80,"shiftHours":1},
    "robot":{"count":2,"payloadKg":250,"speedMps":0.8,"loadSeconds":10,"unloadSeconds":10,"batteryWh":2400,"chargeW":1000,"whPerMeter":0.25,"chargerCount":1},
    "mode":"fixed","seed":42
  },
  "operations": [
    {"id":"machine-1","label":"Обработка","x":7,"y":5,"durationSeconds":70,"capacity":1,"transformsLoad":true,"stochastic":false},
    {"id":"machine-2","label":"Контроль","x":12,"y":8,"durationSeconds":25,"capacity":1,"transformsLoad":false,"stochastic":false}
  ],
  "clearanceMeters":0.15,"replications":5,"reworkProbability":0
}
```

Ответ 200: `engine`, `scenarioHash`, `run.metrics`, `run.trace.events[]`, `experiment.metrics`, `experiment.seeds`, `limitations`. Ответ 422: список ошибок валидации или несовместимый маршрут/вес/ресурс. Транспорт и обработка модели действительно исполняются; поля не заполняются фиктивными числами.

**Ограничение публичной площадки:** не более 90 входных заявок, 2 часов смены, 15 роботов, 10 независимых прогонов, 5 постов; тело запроса не более 2 МБ. Эти ограничения предохраняют публичный Worker от чрезмерных затрат CPU и памяти. Для частной локальной симуляции используйте `runAgentStudy` из `packages/agent-studio/model.ts` с техническими лимитами core.

## Другие API оригинального дизайна

- `GET /api/v1/health`
- `GET /api/v1/catalog` — исходный справочник 44 карточек.
- `POST /api/v1/assessments` — сравнительный подбор по правилам.
- `POST /api/v1/compare` — сравнение 2–4 изделий.
- `POST /api/v1/ris/experiment` — **legacy SimPy**; требует независимой настройки `SIMULATION_ENGINE_URL` и `SIMULATION_SERVICE_KEY`; на новом публичном Worker возвращает 503, не выдаётся за работающий. Основной новый сценарий — `/api/v1/agent/study`.

Все результаты модели — расчётные, отраслевые шаблоны демонстрационные.
