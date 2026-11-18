# Lab 5 — Weather Compare (GraphQL)

Сравнение погоды по городам из **3 источников**. Клиент ↔ backend **только GraphQL**.

## Источники

1. **Open-Meteo Forecast** — прогноз  
2. **Open-Meteo Archive** — история  
3. **MET Norway** — locationforecast  

При сбое API — retry + локальный fallback (≥10 000 readings).

## Архитектура

```
UI → Gateway :4005
       ├── readings :4001
       ├── cities   :4002
       └── ops      :4003
```

## Запуск

```bash
cd lab5
npm install
npm run collect
npm start
```

- UI: http://localhost:4005  
- GraphQL: http://localhost:4005/graphql  
- Metrics: http://localhost:4005/metrics  

## Доп. функционал

- `compareCity(cityId)` — avg/min/max °C и **разброс** между источниками  
- `related` — показания того же города из других API  
- nested `city { readings { … } }`  
- rate limit, `/metrics`, `extensions.traceId`
