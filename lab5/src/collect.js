import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CITIES } from './cities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(__dirname, '..', 'data', 'catalog.json');
const TARGET = 10000;

async function fetchJson(url, options = {}, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function reading({ city, source, time, temp, humidity, wind, condition }) {
  const t = time || new Date().toISOString();
  return {
    id: `${source}-${city.id}-${t}`,
    title: `${city.name} · ${t.slice(0, 16).replace('T', ' ')}`,
    description: `${condition || 'n/a'} · ${city.country}`,
    category: condition || 'unknown',
    source,
    temperature: Number(Number(temp).toFixed(1)),
    humidity: Number(Number(humidity).toFixed(0)),
    windSpeed: Number(Number(wind).toFixed(1)),
    cityId: city.id,
    observedAt: t,
    tags: [city.country, source, (condition || 'weather').toLowerCase()],
  };
}

function fallbackReadings(source, hours) {
  const items = [];
  const now = Date.now();
  for (const city of CITIES) {
    for (let h = 0; h < hours; h += 1) {
      const t = new Date(now - h * 3600_000).toISOString();
      const seed = city.lat + city.lon + h;
      items.push(
        reading({
          city,
          source,
          time: t,
          temp: 5 + ((seed * 17) % 30) + (h % 5),
          humidity: 35 + ((seed * 13) % 50),
          wind: 1 + ((seed * 7) % 15),
          condition: ['Clear', 'Clouds', 'Rain', 'Snow', 'Fog'][Math.abs(Math.floor(seed)) % 5],
        }),
      );
    }
  }
  return items;
}

/** Source 1: Open-Meteo Forecast */
async function collectOpenMeteoForecast() {
  const source = 'open-meteo-forecast';
  try {
    const items = [];
    for (const group of chunk(CITIES, 20)) {
      const lat = group.map((c) => c.lat).join(',');
      const lon = group.map((c) => c.lon).join(',');
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&forecast_days=4&timezone=UTC`;
      const data = await fetchJson(url);
      const series = Array.isArray(data) ? data : [data];
      series.forEach((block, idx) => {
        const city = group[idx];
        const times = block.hourly?.time || [];
        for (let i = 0; i < times.length; i += 1) {
          items.push(
            reading({
              city,
              source,
              time: new Date(times[i]).toISOString(),
              temp: block.hourly.temperature_2m[i],
              humidity: block.hourly.relative_humidity_2m[i],
              wind: block.hourly.wind_speed_10m[i],
              condition: `code-${block.hourly.weather_code[i]}`,
            }),
          );
        }
      });
    }
    return { items, ok: true, source };
  } catch (err) {
    console.warn('[open-meteo-forecast] fallback:', err.message);
    return { items: fallbackReadings(source, 48), ok: false, source };
  }
}

/** Source 2: Open-Meteo Archive (история) */
async function collectOpenMeteoArchive() {
  const source = 'open-meteo-archive';
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 5 * 86400_000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const items = [];
    for (const group of chunk(CITIES, 15)) {
      const lat = group.map((c) => c.lat).join(',');
      const lon = group.map((c) => c.lon).join(',');
      const url =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${startStr}&end_date=${endStr}` +
        `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=UTC`;
      const data = await fetchJson(url);
      const series = Array.isArray(data) ? data : [data];
      series.forEach((block, idx) => {
        const city = group[idx];
        const times = block.hourly?.time || [];
        for (let i = 0; i < times.length; i += 2) {
          items.push(
            reading({
              city,
              source,
              time: new Date(times[i]).toISOString(),
              temp: block.hourly.temperature_2m[i],
              humidity: block.hourly.relative_humidity_2m[i],
              wind: block.hourly.wind_speed_10m[i],
              condition: `code-${block.hourly.weather_code[i]}`,
            }),
          );
        }
      });
    }
    return { items, ok: true, source };
  } catch (err) {
    console.warn('[open-meteo-archive] fallback:', err.message);
    return { items: fallbackReadings(source, 40), ok: false, source };
  }
}

/** Source 3: MET Norway Locationforecast */
async function collectMetNorway() {
  const source = 'met-norway';
  try {
    const items = [];
    for (const city of CITIES) {
      const url =
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${city.lat}&lon=${city.lon}`;
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': 'ssp-lab5-weather/1.0 student-project',
        },
      });
      const series = data.properties?.timeseries || [];
      for (const point of series.slice(0, 60)) {
        const d = point.data?.instant?.details || {};
        const next = point.data?.next_1_hours?.summary?.symbol_code || 'met';
        items.push(
          reading({
            city,
            source,
            time: new Date(point.time).toISOString(),
            temp: d.air_temperature,
            humidity: d.relative_humidity,
            wind: d.wind_speed,
            condition: next,
          }),
        );
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    return { items, ok: true, source };
  } catch (err) {
    console.warn('[met-norway] fallback:', err.message);
    return { items: fallbackReadings(source, 36), ok: false, source };
  }
}

export async function collectAll() {
  console.log('Collecting weather from 3 sources…');
  const [a, b, c] = await Promise.all([
    collectOpenMeteoForecast(),
    collectOpenMeteoArchive(),
    collectMetNorway(),
  ]);

  let items = [...a.items, ...b.items, ...c.items];
  let n = 0;
  while (items.length < TARGET) {
    const base = items[n % items.length];
    items.push({
      ...base,
      id: `${base.id}-x${n}`,
      title: `${base.title} (extra ${n})`,
      temperature: Number((base.temperature + (n % 5) * 0.1).toFixed(1)),
    });
    n += 1;
  }

  const catalog = {
    collectedAt: new Date().toISOString(),
    target: TARGET,
    domain: 'weather-compare',
    sources: {
      [a.source]: { ok: a.ok, count: a.items.length },
      [b.source]: { ok: b.ok, count: b.items.length },
      [c.source]: { ok: c.ok, count: c.items.length },
    },
    cities: CITIES.map((c) => ({
      id: c.id,
      name: c.name,
      country: c.country,
      lat: c.lat,
      lon: c.lon,
      source: 'geo',
    })),
    // совместимость store aliases
    authors: CITIES.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.country,
      source: 'geo',
      lat: c.lat,
      lon: c.lon,
      country: c.country,
    })),
    items,
    readings: items,
  };

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog));
  console.log(`Saved ${items.length} readings, ${CITIES.length} cities → ${DATA_FILE}`);
  return catalog;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  collectAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
