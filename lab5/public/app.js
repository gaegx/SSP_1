const GQL = '/graphql';
let page = 1;

const escapeHtml = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

async function gql(query, variables = {}) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-trace-id': crypto.randomUUID(),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  const trace = json.extensions?.traceId || '—';
  const ms = json.extensions?.gatewayMs ?? '—';
  document.getElementById('trace').textContent =
    `${res.status} · ${String(trace).slice(0, 8)}… · ${ms} ms`;
  if (res.status === 429) throw new Error(json.errors?.[0]?.message || 'Rate limited');
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

function buildFilter() {
  const source = document.getElementById('source').value || null;
  const country = document.getElementById('country').value.trim().toUpperCase() || null;
  const minRaw = document.getElementById('minTemp').value;
  const minTemp = minRaw === '' ? null : Number(minRaw);
  if (!source && !country && minTemp == null) return null;
  const filter = {};
  if (source) filter.source = source;
  if (country) filter.country = country;
  if (minTemp != null && !Number.isNaN(minTemp)) filter.minTemp = minTemp;
  return filter;
}

async function loadMetrics() {
  try {
    const m = await (await fetch('/metrics')).json();
    document.getElementById('foot-metrics').textContent =
      `req ${m.requests} · 429 ${m.rejected} · p95 ${m.latencyMs?.p95}ms · inFlight ${m.inFlight}/${m.maxInFlight}`;
    const allOk = (m.subgraphs || []).every((s) => s.ok);
    const pill = document.getElementById('status-pill');
    pill.textContent = allOk ? 'healthy' : 'degraded';
    pill.classList.toggle('bad', !allOk);
  } catch {
    document.getElementById('status-pill').textContent = 'down';
    document.getElementById('status-pill').classList.add('bad');
  }
}

async function loadMeta() {
  const data = await gql(`{
    health { status items }
    meta { totalItems totalCities sources { name count ok } }
    cities(limit: 100) { id name country }
  }`);
  document.getElementById('total-pill').textContent =
    `${data.meta.totalItems.toLocaleString('ru-RU')} readings`;
  document.getElementById('sources').innerHTML = data.meta.sources
    .map(
      (s) =>
        `<span class="chip ${s.ok ? 'ok' : 'bad'}">${escapeHtml(s.name)} · ${s.count} · ${
          s.ok ? 'api' : 'fallback'
        }</span>`,
    )
    .join('');

  const sel = document.getElementById('compare-city');
  sel.innerHTML = data.cities
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.country || '')})</option>`)
    .join('');
  await loadMetrics();
}

function readingsQuery(deep) {
  const cityFields = deep
    ? `city { id name country readings(limit: 2) { nodes { title temperature source } } }`
    : `city { id name country }`;
  return `query Readings($search: String, $filter: ReadingFilterInput, $sortBy: SortField, $sortDir: SortDir, $page: Int) {
    readings(search: $search, filter: $filter, sortBy: $sortBy, sortDir: $sortDir, page: $page, limit: 10) {
      pageInfo { page pages total hasNextPage hasPrevPage }
      nodes {
        id title description source category temperature humidity windSpeed observedAt
        ${cityFields}
        related(limit: 2) { title temperature source }
      }
    }
  }`;
}

async function loadReadings() {
  const err = document.getElementById('err');
  err.hidden = true;
  const deep = document.getElementById('deep').checked;
  try {
    const data = await gql(readingsQuery(deep), {
      search: document.getElementById('search').value.trim() || null,
      filter: buildFilter(),
      sortBy: document.getElementById('sortBy').value,
      sortDir: document.getElementById('sortDir').value,
      page,
    });
    const { nodes, pageInfo } = data.readings;
    document.getElementById('page-label').textContent =
      `page ${pageInfo.page}/${pageInfo.pages} · ${pageInfo.total.toLocaleString('ru-RU')} found`;
    document.getElementById('prev').disabled = !pageInfo.hasPrevPage;
    document.getElementById('next').disabled = !pageInfo.hasNextPage;

    const list = document.getElementById('list');
    if (!nodes.length) {
      list.innerHTML = '<div class="empty">No readings. Try another filter or Refresh data.</div>';
      return;
    }

    list.innerHTML = nodes
      .map((n) => {
        const nested = (n.city?.readings?.nodes || [])
          .map((x) => `${x.temperature}° ${x.source}`)
          .join(' · ');
        const related = (n.related || [])
          .map((r) => `${r.temperature}° ${r.source}`)
          .join(' · ');
        return `<article class="card">
          <h3>${escapeHtml(n.city?.name || n.title)}</h3>
          <div class="temp">${n.temperature}°C</div>
          <p class="desc">${escapeHtml(n.observedAt.slice(0, 16).replace('T', ' '))} · humidity ${n.humidity}% · wind ${n.windSpeed}</p>
          <div class="nest">
            <div><b>city</b><span>${escapeHtml(n.city?.name || '—')} (${escapeHtml(n.city?.country || '—')})</span></div>
            ${deep && nested ? `<div><b>readings</b><span>${escapeHtml(nested)}</span></div>` : ''}
            <div><b>related</b><span>${escapeHtml(related || '—')}</span></div>
          </div>
          <div class="badges">
            <span class="badge">${escapeHtml(n.source)}</span>
            <span class="badge">${escapeHtml(n.category || '—')}</span>
          </div>
        </article>`;
      })
      .join('');
    await loadMetrics();
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message;
  }
}

document.getElementById('btn-load').onclick = () => {
  page = 1;
  loadReadings();
};
document.getElementById('prev').onclick = () => {
  page = Math.max(1, page - 1);
  loadReadings();
};
document.getElementById('next').onclick = () => {
  page += 1;
  loadReadings();
};
document.getElementById('btn-compare').onclick = async () => {
  const cityId = document.getElementById('compare-city').value;
  const data = await gql(
    `query($cityId: ID!) {
      compareCity(cityId: $cityId) {
        spread
        city { name country }
        sources { source count avgTemp minTemp maxTemp latestTemp }
      }
    }`,
    { cityId },
  );
  const c = data.compareCity;
  if (!c) {
    document.getElementById('compare-out').textContent = 'City not found';
    return;
  }
  document.getElementById('compare-out').textContent =
    `${c.city.name} (${c.city.country}) · spread ${c.spread}°C\n` +
    c.sources
      .map(
        (s) =>
          `${s.source}: n=${s.count} avg=${s.avgTemp} min=${s.minTemp} max=${s.maxTemp} latest=${s.latestTemp}`,
      )
      .join('\n');
};
document.getElementById('btn-note').onclick = async () => {
  const title = document.getElementById('note-title').value.trim();
  if (!title) return;
  await gql(`mutation($title: String!) { addNote(title: $title) { id title source } }`, { title });
  document.getElementById('note-title').value = '';
  document.getElementById('source').value = 'local';
  page = 1;
  await loadMeta();
  await loadReadings();
};
document.getElementById('btn-refresh').onclick = async () => {
  document.getElementById('trace').textContent = 'refreshCatalog…';
  await gql(`mutation { refreshCatalog { ok totalItems message } }`);
  page = 1;
  await loadMeta();
  await loadReadings();
};

loadMeta()
  .then(loadReadings)
  .catch((e) => {
    document.getElementById('err').hidden = false;
    document.getElementById('err').textContent = e.message;
  });
setInterval(loadMetrics, 5000);
