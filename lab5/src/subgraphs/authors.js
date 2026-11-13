import { createServer } from 'node:http';
import { createSchema, createYoga } from 'graphql-yoga';
import { COMMON_ENUMS, mapSort } from '../shared.js';
import {
  getCatalog,
  getAuthor,
  queryItemsByAuthor,
  loadCatalog,
} from '../store.js';
import fs from 'fs';
import { DATA_FILE } from '../collect.js';

const PORT = Number(process.env.AUTHORS_PORT) || 4002;

if (!fs.existsSync(DATA_FILE)) {
  console.error('No catalog — run npm run collect');
  process.exit(1);
}
loadCatalog();

const typeDefs = /* GraphQL */ `
  ${COMMON_ENUMS}

  type Item {
    id: ID!
    title: String!
    description: String
    category: String
    source: String!
    price: Float!
    rating: Float!
    tags: [String!]!
    createdAt: String!
  }

  type Author {
    id: ID!
    name: String!
    email: String
    source: String!
    items(
      search: String
      category: String
      sortBy: SortField = TITLE
      sortDir: SortDir = ASC
      page: Int = 1
      limit: Int = 10
    ): ItemConnection!
  }

  type Query {
    author(id: ID!): Author
    authors(search: String, page: Int = 1, limit: Int = 20): [Author!]!
  }
`;

const resolvers = {
  Query: {
    author: (_r, { id }) => getAuthor(id),
    authors: (_r, { search, page = 1, limit = 20 }) => {
      let list = getCatalog().authors;
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q),
        );
      }
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      const start = (Math.max(page, 1) - 1) * safeLimit;
      return list.slice(start, start + safeLimit);
    },
  },
  Author: {
    items: (author, args) =>
      queryItemsByAuthor(author.id, {
        search: args.search,
        category: args.category,
        page: args.page,
        limit: args.limit,
        ...mapSort(args.sortBy, args.sortDir),
      }),
  },
};

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  landingPage: false,
});

createServer(yoga).listen(PORT, () => {
  console.log(`[authors] http://127.0.0.1:${PORT}/graphql`);
});

setInterval(() => {
  try {
    loadCatalog();
  } catch {
    /* ignore */
  }
}, 10000);
