const G = 'http://localhost:4005/graphql';
async function gql(query, variables) {
  const res = await fetch(G, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const a = await gql(`{
  items(search: "Generated", filter: { source: "dummyjson" }, sortBy: PRICE, sortDir: DESC, page: 1, limit: 2) {
    pageInfo { total }
    nodes {
      title price source
      author { name items(limit: 2) { nodes { title } } }
      related(limit: 1) { title }
    }
  }
}`);
console.log('search Generated + dummyjson:\n', JSON.stringify(a, null, 2));

const b = await gql(`{
  items(filter: { source: "jsonplaceholder", minPrice: 100 }, sortBy: RATING, sortDir: DESC, limit: 2) {
    pageInfo { total }
    nodes { title price rating author { name } }
  }
}`);
console.log('\njp minPrice 100:\n', JSON.stringify(b.data, null, 2));

const c = await gql(`{ item(id: "jp-1-0") { id title author { id name email items(limit: 1) { pageInfo { total } nodes { title } } } } }`);
console.log('\nitem by id + deep author.items:\n', JSON.stringify(c, null, 2));
