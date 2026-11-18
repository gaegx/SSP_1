import { createServer } from 'node:http';
import { createSchema, createYoga } from 'graphql-yoga';
import { COMMON_ENUMS, mapSort } from '../shared.js';
import {
  getCatalog,
  getCity,
  queryReadingsByCity,
  loadCatalog,
  compareCity,
} from '../store.js';
import fs from 'fs';
import { DATA_FILE } from '../collect.js';
import { config } from '../config.js';

const PORT = config.authorsPort;

if (!fs.existsSync(DATA_FILE)) {
  console.error('No catalog — run npm run collect');
  process.exit(1);
}
loadCatalog();

const typeDefs = /* GraphQL */ `
  ${COMMON_ENUMS}

  type Reading {
    id: ID!
    title: String!
    description: String
    category: String
    source: String!
    temperature: Float!
    humidity: Float!
    windSpeed: Float!
    tags: [String!]!
    observedAt: String!
  }

  type SourceCompare {
    source: String!
    count: Int!
    avgTemp: Float!
    minTemp: Float!
    maxTemp: Float!
    latestTemp: Float
    latestAt: String
  }

  type CityComparison {
    city: City!
    spread: Float!
    sources: [SourceCompare!]!
  }

  type City {
    id: ID!
    name: String!
    country: String
    lat: Float
    lon: Float
    source: String!
    readings(
      search: String
      category: String
      sortBy: SortField = OBSERVED_AT
      sortDir: SortDir = DESC
      page: Int = 1
      limit: Int = 10
    ): ReadingConnection!
    comparison: CityComparison
  }

  type Query {
    city(id: ID!): City
    cities(search: String, country: String, page: Int = 1, limit: Int = 20): [City!]!
  }
`;

const resolvers = {
  Query: {
    city: (_r, { id }) => getCity(id),
    cities: (_r, { search, country, page = 1, limit = 20 }) => {
      let list = getCatalog().authors;
      if (country) list = list.filter((a) => (a.country || a.email) === country);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            String(a.country || a.email || '')
              .toLowerCase()
              .includes(q),
        );
      }
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      const start = (Math.max(page, 1) - 1) * safeLimit;
      return list.slice(start, start + safeLimit);
    },
  },
  City: {
    country: (c) => c.country || c.email || null,
    readings: (city, args) =>
      queryReadingsByCity(city.id, {
        search: args.search,
        category: args.category,
        page: args.page,
        limit: args.limit,
        ...mapSort(args.sortBy, args.sortDir),
      }),
    comparison: (city) => compareCity(city.id),
  },
};

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  landingPage: false,
});

createServer(yoga).listen(PORT, () => {
  console.log(`[cities] http://127.0.0.1:${PORT}/graphql`);
});

setInterval(() => {
  try {
    loadCatalog();
  } catch {
    /* ignore */
  }
}, 10000);
