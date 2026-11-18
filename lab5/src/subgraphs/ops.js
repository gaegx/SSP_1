import { createServer } from 'node:http';
import { createSchema, createYoga } from 'graphql-yoga';
import {
  getCatalog,
  setCatalog,
  loadCatalog,
  sourceStats,
  reloadFromDisk,
} from '../store.js';
import { collectAll, DATA_FILE } from '../collect.js';
import fs from 'fs';
import { config } from '../config.js';

const PORT = config.opsPort;

if (fs.existsSync(DATA_FILE)) loadCatalog();

const typeDefs = /* GraphQL */ `
  type SourceStats {
    name: String!
    count: Int!
    ok: Boolean!
  }

  type CatalogMeta {
    collectedAt: String!
    totalItems: Int!
    totalCities: Int!
    totalAuthors: Int!
    sources: [SourceStats!]!
  }

  type Health {
    status: String!
    uptime: Float!
    items: Int!
    service: String!
  }

  type RefreshPayload {
    ok: Boolean!
    totalItems: Int!
    message: String!
  }

  type Query {
    health: Health!
    meta: CatalogMeta!
    sources: [SourceStats!]!
  }

  type Mutation {
    refreshCatalog: RefreshPayload!
  }
`;

const resolvers = {
  Query: {
    health: () => {
      try {
        const c = getCatalog();
        return {
          status: 'ok',
          uptime: process.uptime(),
          items: c.items.length,
          service: 'ops',
        };
      } catch {
        return { status: 'degraded', uptime: process.uptime(), items: 0, service: 'ops' };
      }
    },
    meta: () => {
      const c = getCatalog();
      return {
        collectedAt: c.collectedAt,
        totalItems: c.items.length,
        totalCities: c.authors.length,
        totalAuthors: c.authors.length,
        sources: sourceStats(),
      };
    },
    sources: () => sourceStats(),
  },
  Mutation: {
    refreshCatalog: async () => {
      const catalog = await collectAll();
      setCatalog(catalog);
      return {
        ok: true,
        totalItems: catalog.items.length,
        message: `Собрано ${catalog.items.length} weather readings из 3 источников`,
      };
    },
  },
};

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  landingPage: false,
});

createServer(yoga).listen(PORT, () => {
  console.log(`[ops] http://127.0.0.1:${PORT}/graphql`);
});

// hot-reload catalog when other process writes (after refresh from ops itself it's fine;
setInterval(() => {
  try {
    if (fs.existsSync(DATA_FILE)) reloadFromDisk();
  } catch {
    /* ignore */
  }
}, 10000);
