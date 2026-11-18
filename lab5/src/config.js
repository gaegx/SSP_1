export const config = {
  port: Number(process.env.PORT) || 4005,
  itemsPort: Number(process.env.ITEMS_PORT) || 4001,
  authorsPort: Number(process.env.AUTHORS_PORT) || 4002,
  opsPort: Number(process.env.OPS_PORT) || 4003,
  itemsUrl: process.env.ITEMS_URL || 'http://127.0.0.1:4001/graphql',
  authorsUrl: process.env.AUTHORS_URL || 'http://127.0.0.1:4002/graphql',
  opsUrl: process.env.OPS_URL || 'http://127.0.0.1:4003/graphql',
  maxInFlight: Number(process.env.MAX_IN_FLIGHT) || 25,
  subgraphTimeoutMs: Number(process.env.SUBGRAPH_TIMEOUT_MS) || 15000,
};
