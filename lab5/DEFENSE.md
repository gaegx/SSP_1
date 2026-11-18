# Защита — Weather Compare

## Суть
Сравниваем погоду по городам из трёх API в одном GraphQL-каталоге. Gateway сшивает сервисы readings / cities / ops.

## Демо
1. Network → только `/graphql`
2. Чипы источников + ≥10000 readings
3. Фильтр source / country / minTemp, сортировка, пагинация
4. Карточка: city → readings + related (другие источники)
5. Compare — разброс температуры между API
6. `/metrics` и trace

## Источники
Open-Meteo Forecast, Open-Meteo Archive, MET Norway (+ fallback).
