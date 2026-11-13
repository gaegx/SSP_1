import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { typeDefs, resolvers } from './schema.js';
import { loadCatalog, getCatalog } from './store.js';
import { collectAll } from './collect.js';
import { DATA_FILE } from './collect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 4005;

async function ensureData() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('catalog.json missing — collecting…');
    await collectAll();
  }
  loadCatalog();
  console.log(`Catalog ready: ${getCatalog().items.length} items`);
}

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  landingPage: false,
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // simple metrics (доп. мониторинг)
  if (url.pathname === '/metrics') {
    const c = getCatalog();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        items: c.items.length,
        authors: c.authors.length,
        sources: c.sources,
      }),
    );
    return;
  }

  if (url.pathname.startsWith('/graphql')) {
    return yoga(req, res);
  }

  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const abs = path.normalize(path.join(PUBLIC, filePath));
  if (!abs.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(abs, (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'text/plain' });
    res.end(buf);
  });
});

await ensureData();
server.listen(PORT, () => {
  console.log(`Lab5 GraphQL → http://localhost:${PORT}`);
  console.log(`GraphQL       → http://localhost:${PORT}/graphql`);
  console.log(`Metrics       → http://localhost:${PORT}/metrics`);
});
