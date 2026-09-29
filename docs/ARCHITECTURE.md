# Архитектура RIS Agent Studio

Версия: 2026-09-29. Цель: быстро исследовать на конкретной геометрии логистический процесс от заявки до выгрузки, сохраняя проверяемую связь между траекторией и экономическими результатами.

## Архитектурный контур

```text
React (сохранённый RIS UI)
  ├─ data/catalog.json + добавления с атрибутированными источниками
  ├─ Facility 2D: размеры, стены, геометрия, точки передачи
  ├─ Process Graph: source → transport → resource → transport → sink
  ├─ Workload: распределение поступлений, масса, смена, seed
  └─ Agent Studio
        ↓ compileAgentScenario (Zod, явная проверка ссылок)
Simulation Core / DES
  ├─ Task agents / pallet entities: identity, lifecycle, source/sink
  ├─ MobileTransportRuntime: экземпляры AMR, задания, диспетчеризация, SOC
  ├─ Navigation: inflated obstacles + visibility graph
  ├─ Motion: segment movement with accel/decel
  ├─ Traffic: reservation table, conflicts, waiting
  ├─ Charging: queue, occupancy, energy and downtime
  ├─ Process Runtime: capacity constraints, FCFS, stochastic times
  ├─ Process Graph: decision/rework and termination guards
  ├─ Reliability: optional MTBF/MTTR for process stations
  └─ EventTrace + ProcessExperiment (independent seeded runs)
        ├─ SVG replay (robots and cargo from EventTrace)
        ├─ KPI and confidence intervals
        └─ Finance gates: CAPEX/OPEX/TCO/ROI/NPV
```

Сопоставимость: все визуализированные роботы и грузы относятся к одному `scenarioHash`, составленному из канонизированных исходных данных. Экономика использует результаты настоящего прогона и серии. Любое изменение технологической цепочки сбрасывает старое исследование.

## Математические механизмы

1. **Workload:** фиксированный интервал `Δt=3600/λ` или пуассоновские интервалы `Δt=-ln(U)/λ` (λ в 1/с); прогон ограничен длительностью смены.
2. **Транспорт:** граф видимости строится по свободной геометрии с консервативно расширенными препятствиями. Маршрут строится для конкретных source/destination и габаритного радиуса робота; несовместимая пара не исполняется.
3. **Движение:** длительность сегмента вычисляется профилем с ускорением и торможением. Резервирование ресурса маршрута отражает интервалы временного конфликта и ожидания. Это макроуровневая модель трафика, не SLAM.
4. **Обработка:** FCFS на ресурсе с `capacity ≥ 1`; время обслуживания детерминированное или логнормальное. Случайное решение `decision` может отправить задание на доработку.
5. **Питание:** путь потребляет Wh по фактическому пробегу; SOC и ёмкость постов ограничивают график подзарядки. Время и очередь к зарядке входят в KPI.
6. **Надёжность:** ядро поддерживает окна отказов ресурса из MTBF/MTTR; пользовательская панель пока не раскрывает эти поля.
7. **Результат:** `throughput=completed/shiftHours`, `backlog=created-completed`, `P95` — эмпирический квантиль завершённых циклов, `utilization` — занятое время / доступное время. По независимым seed считаются среднее и ДИ Стьюдента 95%. Это неопределённость **модели**, а не доверие к правдоподобию предприятия.

## Финансовые связи

```text
CAPEX = robotCount × purchasePrice + installation + infrastructure + chargingCost
AnnualOPEX = annualMaintenance + energyPerShift × daysPerYear × electricityPrice
TCO = CAPEX + horizonYears × (AnnualOPEX + residualHumanCostAnnual)
AnnualBenefit = baselineCostAnnual - residualHumanCostAnnual - AnnualOPEX
ROI = (AnnualBenefit × horizonYears - CAPEX) / CAPEX × 100%
NPV = -CAPEX + Σ[t=1..horizonYears] AnnualBenefit/(1+discountRate)^t
Payback = CAPEX / AnnualBenefit   (only when AnnualBenefit > 0)
```

ROI/NPV и срок окупаемости **блокируются**, если не доказано выполнение требуемого объёма с обеих сторон (до/после), исходные расходы не введены, CAPEX=0, либо нижняя граница 95% ДИ / хотя бы один из независимых прогонов не покрывает годовой спрос. Параметры CAPEX требуют проверки коммерческих условий; запрет на фиктивные цены.

## Как воспроизвести исследования

Один сценарий сериализуется как `ris-simulation-scenario/2`, а его `scenarioHash` встраивается в `ris-event-trace/1`. `runProcessNetwork(scenario, transport)` возвращает тот же первый прогон, который показывается на карте. `runProcessExperiment` повторяет расчёт с фиксируемыми различными seed и выдаёт доверительные интервалы. Для независимой проверки меняйте **ровно один параметр** и сравнивайте `scenarioHash`, event trace и метрики.

## Критически недостающие возможности для уровня AnyLogic

- Agent-based поведение на уровне конфликтующих ролей, пешеходов, автомобилей и роботов; специфические стратегии каждого производителя.
- Калиброванные карты, лифты, зоны доступа, подтверждённые ширины и высоты, скользящие ограничения, отдельные уровни.
- Состояния физической сцепки и грузоподъёмных устройств; проверка кинематики, радиусов поворота, динамических препятствий.
- Машинная обработка многопродуктовых партий, конечные буферы, переналадка, графики персонала, расписания и специфические MES/WMS.
- Формальная верификация маршрутов с реальным логом АСУ/AMR и испытаниями на объекте.

**Статус:** функциональный демонстрационный прототип для предварительного технико-экономического исследования. Не выдавайте продукт за 1:1 AnyLogic или подтверждённый проект внедрения.
