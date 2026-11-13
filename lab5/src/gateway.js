import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { metrics, recordLatency, snapshot } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 4005;
const ITEMS_URL = process.env.ITEMS_URL || 'http://127.0.0.1:4001/graphql';
const AUTHORS_URL = process.env.AUTHORS_URL || 'http://127.0.0.1:4002/graphql';
const OPS_URL = process.env.OPS_URL || 'http://127.0.0.1:4003/graphql';
const MAX_IN_FLIGHT = Number(process.env.MAX_IN_FLIGHT) || 25;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function timedExecutor(name, endpoint) {
  const base = buildHTTPExecutor({
    endpoint,
    timeout: 15000,
  });
  return async (request) => {
    const t0 = Date.now();
    try {
      const result = await base(request);
      if (result?.errors?.length) metrics.subgraphErrors[name] += 1;
      return {
        ...result,
        extensions: {
          ...(result.extensions || {}),
          subgraphTiming: { [name]: Date.now() - t0 },
        },
      };
    } catch (err) {
      metrics.subgraphErrors[name] += 1;
      throw err;
    }
  };
}

async function waitFor(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Subgraph not ready: ${url}`);
}

async function buildGatewaySchema() {
  await Promise.all([waitFor(ITEMS_URL), waitFor(AUTHORS_URL), waitFor(OPS_URL)]);

  const itemsExec = timedExecutor('items', ITEMS_URL);
  const authorsExec = timedExecutor('authors', AUTHORS_URL);
  const opsExec = timedExecutor('ops', OPS_URL);

  const [itemsSchema, authorsSchema, opsSchema] = await Promise.all([
    schemaFromExecutor(itemsExec),
    schemaFromExecutor(authorsExec),
    schemaFromExecutor(opsExec),
  ]);

  return stitchSchemas({
    subschemas: [
      {
        schema: itemsSchema,
        executor: itemsExec,
        merge: {
          Item: {
            selectionSet: '{ id }',
            fieldName: 'item',
            args: ({ id }) => ({ id }),
          },
        },
      },
      {
        schema: authorsSchema,
        executor: authorsExec,
        merge: {
          Author: {
            selectionSet: '{ id }',
            fieldName: 'author',
            args: ({ id }) => ({ id }),
          },
        },
      },
      {
        schema: opsSchema,
        executor: opsExec,
      },
    ],
  });
}

async function subgraphHealth() {
  const check = async (name, url) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: AbortSignal.timeout(2000),
      });
      return { name, ok: res.ok, url };
    } catch (err) {
      return { name, ok: false, url, error: err.message };
    }
  };
  return Promise.all([
    check('items', ITEMS_URL),
    check('authors', AUTHORS_URL),
    check('ops', OPS_URL),
  ]);
}

console.log('Building stitched gateway schema…');
const schema = await buildGatewaySchema();

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  landingPage: true,
  plugins: [
    {
      onExecute({ args }) {
        const t0 = Date.now();
        const traceId = args.contextValue?.traceId || randomUUID();
        args.contextValue.traceId = traceId;
        args.contextValue.t0 = t0;
        metrics.inFlight += 1;
        metrics.requests += 1;
        return {
          onExecuteDone({ result, setResult }) {
            const done = (payload) => {
              metrics.inFlight = Math.max(0, metrics.inFlight - 1);
              const ms = Date.now() - t0;
              recordLatency(ms);
              if (payload?.errors?.length) {
                metrics.errors += 1;
                metrics.byStatus.error = (metrics.byStatus.error || 0) + 1;
              } else {
                metrics.byStatus.ok = (metrics.byStatus.ok || 0) + 1;
              }
              const timings = payload?.extensions?.subgraphTiming || {};
              setResult({
                ...payload,
                extensions: {
                  ...(payload.extensions || {}),
                  traceId,
                  gatewayMs: ms,
                  tracing: { traceId, gatewayMs: ms, subgraphs: timings },
                },
              });
            };
            if (result && typeof result[Symbol.asyncIterator] === 'function') {
              return {
                onNext({ result: next, setResult: setNext }) {
                  metrics.inFlight = Math.max(0, metrics.inFlight - 1);
                  const ms = Date.now() - t0;
                  recordLatency(ms);
                  setNext({
                    ...next,
                    extensions: {
                      ...(next.extensions || {}),
                      traceId,
                      gatewayMs: ms,
                      tracing: { traceId, gatewayMs: ms },
                    },
                  });
                },
              };
            }
            done(result);
          },
        };
      },
    },
  ],
  context: ({ request }) => ({
    traceId: request.headers.get('x-trace-id') || randomUUID(),
  }),
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/metrics') {
    const subgraphs = await subgraphHealth();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify(
        snapshot({
          maxInFlight: MAX_IN_FLIGHT,
          architecture: 'gateway + 3 subgraphs (schema stitching)',
          subgraphs,
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/graphql')) {
    if (metrics.inFlight >= MAX_IN_FLIGHT) {
      metrics.rejected += 1;
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: 'Too many requests — rate limited' }] }));
      return;
    }
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

server.listen(PORT, () => {
  console.log(`[gateway] http://localhost:${PORT}`);
  console.log(`[gateway] GraphQL  → http://localhost:${PORT}/graphql`);
  console.log(`[gateway] Metrics  → http://localhost:${PORT}/metrics`);
});
