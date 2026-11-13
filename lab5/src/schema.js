import {
  getCatalog,
  getItem,
  getAuthor,
  queryItems,
  queryItemsByAuthor,
  sourceStats,
  setCatalog,
} from './store.js';
import { collectAll } from './collect.js';

export const typeDefs = /* GraphQL */ `
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

  type PageInfo {
    page: Int!
    limit: Int!
    total: Int!
    pages: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  type ItemConnection {
    nodes: [Item!]!
    pageInfo: PageInfo!
  }

  type SourceStats {
    name: String!
    count: Int!
    ok: Boolean!
  }

  type CatalogMeta {
    collectedAt: String!
    totalItems: Int!
    totalAuthors: Int!
    sources: [SourceStats!]!
  }

  type RefreshPayload {
    ok: Boolean!
    totalItems: Int!
    message: String!
  }

  type Health {
    status: String!
    uptime: Float!
    items: Int!
  }

  enum SortField {
    TITLE
    PRICE
    RATING
    CREATED_AT
    SOURCE
  }

  enum SortDir {
    ASC
    DESC
  }

  input ItemFilterInput {
    source: String
    category: String
    minPrice: Float
    maxPrice: Float
    minRating: Float
  }

  type Query {
    health: Health!
    meta: CatalogMeta!
    sources: [SourceStats!]!
    item(id: ID!): Item
    items(
      search: String
      filter: ItemFilterInput
      sortBy: SortField = TITLE
      sortDir: SortDir = ASC
      page: Int = 1
      limit: Int = 20
    ): ItemConnection!
    author(id: ID!): Author
    authors(search: String, page: Int = 1, limit: Int = 20): [Author!]!
  }

  type Mutation {
    refreshCatalog: RefreshPayload!
    addNote(title: String!, description: String, category: String): Item!
  }
`;

const SORT_MAP = {
  TITLE: 'title',
  PRICE: 'price',
  RATING: 'rating',
  CREATED_AT: 'createdAt',
  SOURCE: 'source',
};

function mapSort(sortBy, sortDir) {
  return {
    sortBy: SORT_MAP[sortBy] || 'title',
    sortDir: sortDir === 'DESC' ? 'desc' : 'asc',
  };
}

export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      uptime: process.uptime(),
      items: getCatalog().items.length,
    }),
    meta: () => {
      const c = getCatalog();
      return {
        collectedAt: c.collectedAt,
        totalItems: c.items.length,
        totalAuthors: c.authors.length,
        sources: sourceStats(),
      };
    },
    sources: () => sourceStats(),
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
      const start = (Math.max(page, 1) - 1) * Math.min(limit, 100);
      return list.slice(start, start + Math.min(limit, 100));
    },
  },
  Mutation: {
    refreshCatalog: async () => {
      const catalog = await collectAll();
      setCatalog(catalog);
      return {
        ok: true,
        totalItems: catalog.items.length,
        message: `Собрано ${catalog.items.length} записей из 3 источников`,
      };
    },
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
        .slice(0, Math.min(limit, 20)),
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
