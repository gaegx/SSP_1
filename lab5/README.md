# Лабораторная №5 — GraphQL (schema stitching)

Клиент ↔ backend **только через GraphQL**. Gateway сшивает **3 subgraph** (распределённая архитектура). Данные из **≥3 источников**, ≥10 000 записей.

## Архитектура

```
UI / GraphQL client
        │
        ▼
 Gateway :4005  (stitch + rate limit + tracing + /metrics)
   ├── items   :4001
   ├── authors :4002
   └── ops     :4003
```

## Запуск

```bash
cd lab5
npm install
npm run collect   # 3 API + fallback ≥10k
npm start         # поднимает 3 subgraph + gateway
```

- UI: http://localhost:4005  
- GraphQL: http://localhost:4005/graphql  
- Metrics: http://localhost:4005/metrics  

## Источники

1. JSONPlaceholder  
2. DummyJSON  
3. Fake Store API  

При сбое — retry + локальный fallback.

## ТЗ

| Требование | Реализация |
|------------|------------|
| Только GraphQL | UI → `POST /graphql` на gateway |
| 3 источника, ≥10k | `npm run collect` |
| Операции + вложенность | Query/Mutation; `Item.author.items`, `related` |
| Динамические запросы | variables + сборка selection set в UI |
| Фильтр / сорт / поиск / пагинация | args у `items` |
| Производительность | in-memory индексы, limit≤100 |
| Отказоустойчивость | retry/fallback collect; изоляция subgraph |
| Нагрузка / мониторинг / трассировка | `MAX_IN_FLIGHT`, `/metrics`, `extensions.tracing` |
| Распределённая архитектура | gateway + 3 HTTP subgraph (schema stitching) |

## Пример

```graphql
query {
  items(search: "phone", filter: { source: "dummyjson" }, sortBy: PRICE, page: 1) {
    pageInfo { total }
    nodes {
      title
      author { name items(limit: 2) { nodes { title } } }
      related { title }
    }
  }
}
```
