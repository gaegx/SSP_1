const GQL = '/graphql';
let page = 1;
let lastTrace = '';

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
  if (res.status === 429) throw new Error(json.errors?.[0]?.message || 'Rate limited');
  lastTrace = json.extensions?.traceId || json.extensions?.tracing?.traceId || '';
  const ms = json.extensions?.gatewayMs;
  const el = document.getElementById('trace');
  if (el) {
    el.textContent = lastTrace
      ? `trace ${lastTrace.slice(0, 8)}… · ${ms ?? '?'} ms`
      : '';
  }
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

function buildFilter() {
  const source = document.getElementById('source').value || null;
  const category = document.getElementById('category').value.trim() || null;
  const minRaw = document.getElementById('minPrice').value;
  const minPrice = minRaw === '' ? null : Number(minRaw);
  if (!source && !category && minPrice == null) return null;
  const filter = {};
  if (source) filter.source = source;
  if (category) filter.category = category;
  if (minPrice != null && !Number.isNaN(minPrice)) filter.minPrice = minPrice;
  return filter;
}

async function loadMeta() {
  const data = await gql(`{
    health { status items service }
    meta { collectedAt totalItems totalAuthors sources { name count ok } }
  }`);
  const m = data.meta;
  const sources = m.sources.map((s) => `${s.name}:${s.count}${s.ok ? '' : '!'}`).join(' · ');
  document.getElementById('meta').textContent =
    `${data.health.status} · ${m.totalItems} записей · ${m.totalAuthors} авторов\n${sources}`;
}

async function loadItems() {
  const err = document.getElementById('err');
  err.hidden = true;
  const search = document.getElementById('search').value.trim() || null;
  const sortBy = document.getElementById('sortBy').value;
  const sortDir = document.getElementById('sortDir').value;
  const filter = buildFilter();

  // динамическое формирование запроса
  const wantAuthorItems = true;
  const authorFields = wantAuthorItems
    ? `author { id name items(limit: 2) { nodes { id title } } }`
    : `author { id name }`;

  try {
    const data = await gql(
      `query Items($search: String, $filter: ItemFilterInput, $sortBy: SortField, $sortDir: SortDir, $page: Int) {
        items(search: $search, filter: $filter, sortBy: $sortBy, sortDir: $sortDir, page: $page, limit: 12) {
          pageInfo { page pages total hasNextPage hasPrevPage }
          nodes {
            id title description source category price rating tags
            ${authorFields}
            related(limit: 2) { id title }
          }
        }
      }`,
      { search, filter, sortBy, sortDir, page },
    );

    const { nodes, pageInfo } = data.items;
    document.getElementById('page-label').textContent =
      `стр. ${pageInfo.page}/${pageInfo.pages} · всего ${pageInfo.total}`;
    document.getElementById('prev').disabled = !pageInfo.hasPrevPage;
    document.getElementById('next').disabled = !pageInfo.hasNextPage;

    const list = document.getElementById('list');
    list.innerHTML = nodes
      .map((n) => {
        const related = (n.related || []).map((r) => r.title).join(' · ') || '—';
        const more = (n.author?.items?.nodes || []).map((x) => x.title).join(' · ') || '—';
        return `<article class="card">
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml((n.description || '').slice(0, 140))}…</p>
          <p><strong>${escapeHtml(n.author?.name || '—')}</strong>
            · related: ${escapeHtml(related)}
            · author.items: ${escapeHtml(more)}</p>
          <div class="badges">
            <span class="badge">${escapeHtml(n.source)}</span>
            <span class="badge">${escapeHtml(n.category || '—')}</span>
            <span class="badge">${n.price} ₽</span>
            <span class="badge">★ ${n.rating}</span>
          </div>
        </article>`;
      })
      .join('');
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

document.getElementById('btn-load').onclick = () => {
  page = 1;
  loadItems();
};
document.getElementById('prev').onclick = () => {
  page = Math.max(1, page - 1);
  loadItems();
};
document.getElementById('next').onclick = () => {
  page += 1;
  loadItems();
};
document.getElementById('btn-refresh').onclick = async () => {
  document.getElementById('meta').textContent = 'refreshCatalog…';
  await gql(`mutation { refreshCatalog { ok totalItems message } }`);
  page = 1;
  await loadMeta();
  await loadItems();
};
document.getElementById('btn-note').onclick = async () => {
  const title = document.getElementById('note-title').value.trim();
  if (!title) return;
  await gql(
    `mutation($title: String!) { addNote(title: $title) { id title source } }`,
    { title },
  );
  document.getElementById('note-title').value = '';
  page = 1;
  await loadItems();
};

loadMeta().then(loadItems);
