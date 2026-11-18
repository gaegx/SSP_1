export const SORT_MAP = {
  TITLE: 'title',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  WIND: 'windSpeed',
  OBSERVED_AT: 'observedAt',
  SOURCE: 'source',
};

export function mapSort(sortBy, sortDir) {
  return {
    sortBy: SORT_MAP[sortBy] || 'observedAt',
    sortDir: sortDir === 'ASC' ? 'asc' : 'desc',
  };
}

export const COMMON_ENUMS = /* GraphQL */ `
  enum SortField {
    TITLE
    TEMPERATURE
    HUMIDITY
    WIND
    OBSERVED_AT
    SOURCE
  }

  enum SortDir {
    ASC
    DESC
  }

  type PageInfo {
    page: Int!
    limit: Int!
    total: Int!
    pages: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  type ReadingConnection {
    nodes: [Reading!]!
    pageInfo: PageInfo!
  }

  input ReadingFilterInput {
    source: String
    category: String
    country: String
    minTemp: Float
    maxTemp: Float
    minHumidity: Float
  }
`;
