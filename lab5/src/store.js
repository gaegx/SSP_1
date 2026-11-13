import fs from 'fs';
import { DATA_FILE } from './collect.js';

let catalog = null;
let byId = new Map();
let byAuthor = new Map();
let bySource = new Map();
let byCategory = new Map();

function rebuildIndexes(data) {
  byId = new Map();
  byAuthor = new Map();
  bySource = new Map();
  byCategory = new Map();
  for (const item of data.items) {
    byId.set(item.id, item);
    if (!byAuthor.has(item.authorId)) byAuthor.set(item.authorId, []);
    byAuthor.get(item.authorId).push(item);
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source).push(item);
    const cat = item.category || 'misc';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(item);
  }
}

export function loadCatalog() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error('Нет data/catalog.json — сначала: npm run collect');
  }
  catalog = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  rebuildIndexes(catalog);
  return catalog;
}

export function getCatalog() {
  if (!catalog) loadCatalog();
  return catalog;
}

export function setCatalog(next) {
  catalog = next;
  rebuildIndexes(catalog);
  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog));
  return catalog;
}

export function reloadFromDisk() {
  return loadCatalog();
}

function candidateList({ source, category, authorId }) {
  if (authorId) return byAuthor.get(authorId) || [];
  if (source && bySource.has(source)) return bySource.get(source);
  if (category && byCategory.has(category)) return byCategory.get(category);
  return getCatalog().items;
}

export function queryItems({
  search,
  source,
  category,
  authorId,
  minPrice,
  maxPrice,
  minRating,
  sortBy = 'title',
  sortDir = 'asc',
  page = 1,
  limit = 20,
}) {
  getCatalog();
  let list = candidateList({ source, category, authorId });

  if (authorId && source) list = list.filter((i) => i.source === source);
  if (authorId && category) list = list.filter((i) => i.category === category);
  if (!authorId && source && category) list = list.filter((i) => i.category === category);
  if (minPrice != null) list = list.filter((i) => i.price >= minPrice);
  if (maxPrice != null) list = list.filter((i) => i.price <= maxPrice);
  if (minRating != null) list = list.filter((i) => i.rating >= minRating);
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

export function getItem(id) {
  getCatalog();
  return byId.get(id) || null;
}

export function getAuthor(id) {
  return getCatalog().authors.find((a) => a.id === id) || null;
}

export function queryItemsByAuthor(authorId, args = {}) {
  return queryItems({ ...args, authorId });
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
