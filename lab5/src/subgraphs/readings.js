import { createServer } from 'node:http';
import { createSchema, createYoga } from 'graphql-yoga';
import { COMMON_ENUMS, mapSort } from '../shared.js';
import {
  getCatalog,
  getReading,
  getCity,
  queryReadings,
  updateCatalog,
  loadCatalog,
  compareCity,
} from '../store.js';
import fs from 'fs';
import { DATA_FILE } from '../collect.js';
import { config } from '../config.js';

const PORT = config.itemsPort;

if (!fs.existsSync(DATA_FILE)) {
  console.error('No catalog — run npm run collect');
  process.exit(1);
}
loadCatalog();

const typeDefs = /* GraphQL */ `
  ${COMMON_ENUMS}

  type City {
    id: ID!
    name: String!
    country: String
    lat: Float
    lon: Float
    source: String!
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
    city: City
    related(limit: Int = 5): [Reading!]!
  }

  type Query {
    reading(id: ID!): Reading
    readings(
      search: String
      filter: ReadingFilterInput
      sortBy: SortField = OBSERVED_AT
      sortDir: SortDir = DESC
      page: Int = 1
      limit: Int = 20
    ): ReadingConnection!
    compareCity(cityId: ID!): CityComparison
  }

  type Mutation {
    addNote(title: String!, description: String): Reading!
  }
`;

const resolvers = {
  Query: {
    reading: (_r, { id }) => getReading(id),
    readings: (_r, args) => {
      const f = args.filter || {};
      return queryReadings({
        search: args.search,
        source: f.source,
        category: f.category,
        country: f.country,
        minTemp: f.minTemp,
        maxTemp: f.maxTemp,
        minHumidity: f.minHumidity,
        page: args.page,
        limit: args.limit,
        ...mapSort(args.sortBy, args.sortDir),
      });
    },
    compareCity: (_r, { cityId }) => compareCity(cityId),
  },
  Mutation: {
    addNote: (_r, { title, description }) =>
      updateCatalog((c) => {
        if (!c.authors.find((a) => a.id === 'manual')) {
          c.authors.push({
            id: 'manual',
            name: 'Manual Note',
            email: 'NOTE',
            country: 'NOTE',
            source: 'local',
            lat: 0,
            lon: 0,
          });
        }
        const item = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          description: description || '',
          category: 'note',
          source: 'local',
          temperature: 0,
          humidity: 0,
          windSpeed: 0,
          tags: ['note', 'manual'],
          cityId: 'manual',
          observedAt: new Date().toISOString(),
        };
        c.items.unshift(item);
        return item;
      }),
  },
  Reading: {
    city: (item) => getCity(item.cityId || item.authorId),
    related: (item, { limit }) =>
      getCatalog()
        .items.filter(
          (i) =>
            i.id !== item.id &&
            (i.cityId || i.authorId) === (item.cityId || item.authorId) &&
            i.source !== item.source,
        )
        .slice(0, Math.min(limit || 5, 20)),
  },
};

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  landingPage: false,
});

createServer(yoga).listen(PORT, () => {
  console.log(`[readings] http://127.0.0.1:${PORT}/graphql`);
});

setInterval(() => {
  try {
    loadCatalog();
  } catch {
    /* ignore */
  }
}, 10000);
