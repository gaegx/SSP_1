const G = 'http://localhost:4005/graphql';

async function gql(url, query, variables) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-trace-id': crypto.randomUUID(),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

console.log('=== 1. Catalog on disk ===');
import fs from 'fs';
const cat = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
console.log({
  items: cat.items.length,
  authors: cat.authors.length,
  sources: cat.sources,
  collectedAt: cat.collectedAt,
});

console.log('\n=== 2. Hit each subgraph directly ===');
for (const [name, url, q] of [
  ['items', 'http://127.0.0.1:4001/graphql', '{ items(limit:1) { pageInfo { total } nodes { id title } } }'],
  ['authors', 'http://127.0.0.1:4002/graphql', '{ authors(limit:1) { id name } }'],
  ['ops', 'http://127.0.0.1:4003/graphql', '{ health { status items service } meta { totalItems } }'],
]) {
  const r = await gql(url, q);
  console.log(name, r.status, JSON.stringify(r.json.data));
}

console.log('\n=== 3. Gateway nested query (stitching) ===');
const nested = await gql(
  G,
  `{
  health { status items }
  items(search: "phone", filter: { source: "dummyjson", minPrice: 10 }, sortBy: PRICE, sortDir: DESC, page: 1, limit: 3) {
    pageInfo { page total pages hasNextPage }
    nodes {
      title price source
      author { name items(limit: 2) { nodes { title } } }
      related(limit: 1) { title }
    }
  }
}`,
);
console.log(JSON.stringify(nested.json, null, 2));

console.log('\n=== 4. Pagination page 2 ===');
const p2 = await gql(
  G,
  `{ items(search: "phone", filter: { source: "dummyjson" }, page: 2, limit: 3) { pageInfo { page total hasPrevPage hasNextPage } nodes { title } } }`,
);
console.log(
  JSON.stringify(p2.json.data.items.pageInfo),
  'nodes:',
  p2.json.data.items.nodes.map((n) => n.title),
);

console.log('\n=== 5. Mutation addNote ===');
const note = await gql(
  G,
  `mutation($t: String!) { addNote(title: $t) { id title source author { name } } }`,
  { t: `TEST NOTE ${Date.now()}` },
);
console.log(JSON.stringify(note.json, null, 2));

console.log('\n=== 6. Metrics ===');
const m = await (await fetch('http://localhost:4005/metrics')).json();
console.log({
  requests: m.requests,
  errors: m.errors,
  rejected: m.rejected,
  inFlight: m.inFlight,
  latencyMs: m.latencyMs,
  subgraphs: m.subgraphs,
});

console.log('\n=== 7. Burst rate-limit smoke (40 parallel) ===');
const burst = await Promise.all(Array.from({ length: 40 }, () => gql(G, '{ health { status } }')));
const codes = burst.reduce((a, r) => {
  a[r.status] = (a[r.status] || 0) + 1;
  return a;
}, {});
console.log({
  statusCounts: codes,
  limited429: burst.filter((r) => r.status === 429).length,
});
