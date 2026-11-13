# Лабораторная №5 — GraphQL-каталог

Клиент ↔ сервер **только через GraphQL**. Данные собираются автоматически из **3 источников**, ≥ 10 000 записей.

## Запуск

```bash
cd lab5
npm install
npm run collect   # сбор из 3 API (+ fallback)
npm start         # http://localhost:4005
```

- UI: http://localhost:4005  
- GraphQL Yoga: http://localhost:4005/graphql  
- Metrics: http://localhost:4005/metrics  

## Источники

1. JSONPlaceholder (posts/users)  
2. DummyJSON (products)  
3. Fake Store API  

При недоступности API — локальный fallback (отказоустойчивость).

## Что закрывает ТЗ

| Требование | Как |
|------------|-----|
| Только GraphQL | UI → `POST /graphql` |
| 3 источника, ≥10k | `npm run collect` |
| Вложенность | `Item.author`, `Author.items`, `Item.related` |
| Фильтр / сорт / поиск / пагинация | args у `items` |
| Производительность | in-memory + пагинация limit≤100 |
| Отказоустойчивость | retry + fallback генераторы |
| Мониторинг (доп.) | `/metrics` |

## Пример запроса

```graphql
query {
  items(
    search: "phone"
    filter: { source: "dummyjson", minPrice: 10 }
    sortBy: PRICE
    sortDir: DESC
    page: 1
    limit: 10
  ) {
    pageInfo { total pages }
    nodes {
      title price source
      author { name items(limit: 2) { nodes { title } } }
      related { title }
    }
  }
}
```
