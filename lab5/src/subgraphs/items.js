import { createServer } from 'node:http';
import { createSchema, createYoga } from 'graphql-yoga';
import { COMMON_ENUMS, mapSort } from '../shared.js';
import {
  getCatalog,
  getItem,
  getAuthor,
  queryItems,
  setCatalog,
  loadCatalog,
} from '../store.js';
import fs from 'fs';
import { DATA_FILE } from '../collect.js';

const PORT = Number(process.env.ITEMS_PORT) || 4001;

if (!fs.existsSync(DATA_FILE)) {
  console.error('No catalog — run npm run collect');
  process.exit(1);
}
loadCatalog();

const typeDefs = /* GraphQL */ `
  ${COMMON_ENUMS}

  type Author {
    id: ID!
    name: String!
    email: String
    source: String!
  }

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
    author: Author
    related(limit: Int = 5): [Item!]!
  }

  type Query {
    item(id: ID!): Item
    items(
      search: String
      filter: ItemFilterInput
      sortBy: SortField = TITLE
      sortDir: SortDir = ASC
      page: Int = 1
      limit: Int = 20
    ): ItemConnection!
  }

  type Mutation {
    addNote(title: String!, description: String, category: String): Item!
  }
`;

const resolvers = {
  Query: {
    item: (_r, { id }) => getItem(id),
    items: (_r, args) => {
      const f = args.filter || {};
      return queryItems({
        search: args.search,
        source: f.source,
        category: f.category,
        minPrice: f.minPrice,
        maxPrice: f.maxPrice,
        minRating: f.minRating,
        page: args.page,
        limit: args.limit,
        ...mapSort(args.sortBy, args.sortDir),
      });
    },
  },
  Mutation: {
    addNote: (_r, { title, description, category }) => {
      const c = getCatalog();
      if (!c.authors.find((a) => a.id === 'local-author')) {
        c.authors.push({
          id: 'local-author',
          name: 'Local Editor',
          email: 'local@lab5.test',
          source: 'local',
        });
      }
      const item = {
        id: `local-${Date.now()}`,
        title,
        description: description || '',
        category: category || 'notes',
        source: 'local',
        price: 0,
        rating: 5,
        tags: ['note', 'manual'],
        authorId: 'local-author',
        createdAt: new Date().toISOString(),
      };
      c.items.unshift(item);
      setCatalog(c);
      return item;
    },
  },
  Item: {
    author: (item) => getAuthor(item.authorId),
    related: (item, { limit }) =>
      getCatalog()
        .items.filter((i) => i.id !== item.id && i.category === item.category)
        .slice(0, Math.min(limit || 5, 20)),
  },
};

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  landingPage: false,
});

createServer(yoga).listen(PORT, () => {
  console.log(`[items] http://127.0.0.1:${PORT}/graphql`);
});

setInterval(() => {
  try {
    loadCatalog();
  } catch {
    /* ignore */
  }
}, 10000);
