# Матрица передаваемых материалов

| Требование конкурса | Состояние в этой рабочей папке | Публичная ссылка |
|---|---|---|
| 🔴 Новый публичный GitHub-репозиторий | **Создан** отдельный публичный проект; код и README составлены в независимом дереве. | https://github.com/CrazyEther/robotization-agent-lab |
| 🔴 README.md с локальным запуском | **Готов**: Node 24+, npm ci/dev/build/test. | https://github.com/CrazyEther/robotization-agent-lab/blob/main/README.md |
| 🔴 Документация архитектуры, стек, API, развёртывание | **Готова** в `docs/`, публичная HTML-копия в assets. | https://ris-agent-studio-2026.battle-walleye.workers.dev/docs/architecture.html |
| 🔴 Презентация | **Готова** PDF 10 слайдов; файл размещается как статический ресурс Worker. | https://ris-agent-studio-2026.battle-walleye.workers.dev/RIS_Agent_Studio_Presentation.pdf |
| 🔴 Прототип / веб-интерфейс | **Развёрнут** отдельный Cloudflare Worker, интерфейс и agent health проверены HTTP 200. | https://ris-agent-studio-2026.battle-walleye.workers.dev |
| Агентная симуляция / ресурсы / потоки | **Демонстрационный расчёт**, тесты покрывают цепочку, реальный replay, нагрузку на пост, вариативность. | /api/v1/agent/health |
| AnyLogic/FlexSim паритет | **Не реализован**. Многоэтажность, 3D-физика, отраслевые предметные модели и валидация на объекте — отдельная задача. | docs/ARCHITECTURE.md |

Прототип — предпроектный калькулятор с воспроизводимой событийной моделью, **не** гарантия ROI и не заключение по технике безопасности.
