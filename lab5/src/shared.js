export const SORT_MAP = {
  TITLE: 'title',
  PRICE: 'price',
  RATING: 'rating',
  CREATED_AT: 'createdAt',
  SOURCE: 'source',
};

export function mapSort(sortBy, sortDir) {
  return {
    sortBy: SORT_MAP[sortBy] || 'title',
    sortDir: sortDir === 'DESC' ? 'desc' : 'asc',
  };
}

export const COMMON_ENUMS = /* GraphQL */ `
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

  input ItemFilterInput {
    source: String
    category: String
    minPrice: Float
    maxPrice: Float
    minRating: Float
  }
`;
