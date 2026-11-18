const G = 'http://localhost:4005/graphql';
async function gql(query, variables) {
  const res = await fetch(G, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const meta = await gql(`{ meta { totalItems totalCities sources { name count ok } } }`);
console.log('meta', JSON.stringify(meta.data.meta, null, 2));

const nested = await gql(`{
  readings(search: "Moscow", sortBy: TEMPERATURE, sortDir: DESC, limit: 2) {
    pageInfo { total }
    nodes {
      temperature source
      city { name country readings(limit: 1) { nodes { temperature source } } }
      related(limit: 2) { source temperature }
    }
  }
}`);
console.log('nested', JSON.stringify(nested, null, 2));

const cmp = await gql(`query { compareCity(cityId: "moscow") { spread city { name } sources { source avgTemp latestTemp count } } }`);
console.log('compare', JSON.stringify(cmp.data, null, 2));
