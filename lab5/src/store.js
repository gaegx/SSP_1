import fs from 'fs';
import { DATA_FILE } from './collect.js';

let catalog = null;
let loadedMtime = 0;
let byId = new Map();
let byCity = new Map();
let bySource = new Map();
let byCategory = new Map();

function rebuildIndexes(data) {
  byId = new Map();
  byCity = new Map();
  bySource = new Map();
  byCategory = new Map();
  for (const item of data.items) {
    byId.set(item.id, item);
    const cityId = item.cityId || item.authorId;
    if (!byCity.has(cityId)) byCity.set(cityId, []);
    byCity.get(cityId).push(item);
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source).push(item);
    const cat = item.category || 'unknown';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(item);
  }
}

function fileMtime() {
  return fs.statSync(DATA_FILE).mtimeMs;
}

export function loadCatalog() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error('Нет data/catalog.json — сначала: npm run collect');
  }
  catalog = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!catalog.authors && catalog.cities) {
    catalog.authors = catalog.cities.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.country,
      source: c.source || 'geo',
      country: c.country,
      lat: c.lat,
      lon: c.lon,
    }));
  }
  loadedMtime = fileMtime();
  rebuildIndexes(catalog);
  return catalog;
}

export function getCatalog() {
  if (!catalog) return loadCatalog();
  try {
    if (fileMtime() !== loadedMtime) loadCatalog();
  } catch {
    /* ignore */
  }
  return catalog;
}

export function setCatalog(next) {
  catalog = next;
  rebuildIndexes(catalog);
  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog));
  loadedMtime = fileMtime();
  return catalog;
}

export function reloadFromDisk() {
  return loadCatalog();
}

export function updateCatalog(mutator, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    reloadFromDisk();
    const expectedMtime = loadedMtime;
    const draft = structuredClone(catalog);
    const result = mutator(draft);
    try {
      if (fileMtime() !== expectedMtime) continue;
    } catch {
      continue;
    }
    setCatalog(draft);
    return result;
  }
  throw new Error('Каталог занят другим обновлением, повторите запрос');
}

function candidateList({ source, category, cityId }) {
  if (cityId) return byCity.get(cityId) || [];
  if (source && bySource.has(source)) return bySource.get(source);
  if (category && byCategory.has(category)) return byCategory.get(category);
  return getCatalog().items;
}

export function queryReadings({
  search,
  source,
  category,
  cityId,
  country,
  minTemp,
  maxTemp,
  minHumidity,
  sortBy = 'observedAt',
  sortDir = 'desc',
  page = 1,
  limit = 20,
}) {
  getCatalog();
  let list = candidateList({ source, category, cityId });

  if (cityId && source) list = list.filter((i) => i.source === source);
  if (cityId && category) list = list.filter((i) => i.category === category);
  if (!cityId && source && category) list = list.filter((i) => i.category === category);
  if (country) {
    const ids = new Set(
      getCatalog()
        .authors.filter((a) => (a.country || a.email) === country)
        .map((a) => a.id),
    );
    list = list.filter((i) => ids.has(i.cityId || i.authorId));
  }
  if (minTemp != null) list = list.filter((i) => i.temperature >= minTemp);
  if (maxTemp != null) list = list.filter((i) => i.temperature <= maxTemp);
  if (minHumidity != null) list = list.filter((i) => i.humidity >= minHumidity);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }

  const total = list.length;
  const dir = sortDir === 'desc' ? -1 : 1;
  list = [...list].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), 'ru') * dir;
  });

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  const start = (safePage - 1) * safeLimit;
  const nodes = list.slice(start, start + safeLimit);
  const pages = Math.max(Math.ceil(total / safeLimit), 1);

  return {
    nodes,
    pageInfo: {
      page: safePage,
      limit: safeLimit,
      total,
      pages,
      hasNextPage: safePage < pages,
      hasPrevPage: safePage > 1,
    },
  };
}

export function getReading(id) {
  getCatalog();
  return byId.get(id) || null;
}

export function getCity(id) {
  return getCatalog().authors.find((a) => a.id === id) || null;
}

export function queryReadingsByCity(cityId, args = {}) {
  return queryReadings({ ...args, cityId });
}

/** Доп. функционал: сравнение источников по городу */
export function compareCity(cityId) {
  const city = getCity(cityId);
  if (!city) return null;
  const readings = byCity.get(cityId) || [];
  const bySourceMap = new Map();
  for (const r of readings) {
    if (!bySourceMap.has(r.source)) bySourceMap.set(r.source, []);
    bySourceMap.get(r.source).push(r);
  }
  const sources = [...bySourceMap.entries()].map(([source, list]) => {
    const temps = list.map((x) => x.temperature);
    const avg = temps.reduce((s, v) => s + v, 0) / temps.length;
    const latest = [...list].sort((a, b) => String(b.observedAt).localeCompare(String(a.observedAt)))[0];
    return {
      source,
      count: list.length,
      avgTemp: Number(avg.toFixed(2)),
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      latestTemp: latest?.temperature ?? null,
      latestAt: latest?.observedAt ?? null,
    };
  });
  const avgs = sources.map((s) => s.avgTemp);
  const spread = avgs.length ? Number((Math.max(...avgs) - Math.min(...avgs)).toFixed(2)) : 0;
  return { city, sources, spread };
}

export function sourceStats() {
  const data = getCatalog();
  const counts = {};
  for (const item of data.items) {
    counts[item.source] = (counts[item.source] || 0) + 1;
  }
  return Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    ok: data.sources?.[name]?.ok ?? true,
  }));
}

// aliases for older names during transition
export const getItem = getReading;
export const getAuthor = getCity;
export const queryItems = queryReadings;
export const queryItemsByAuthor = queryReadingsByCity;
