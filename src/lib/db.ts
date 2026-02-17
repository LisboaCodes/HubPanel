import { Pool, PoolConfig, QueryResult } from "pg";

export interface DatabaseConfig {
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const pools: Map<string, Pool> = new Map();

/**
 * Read all database configurations from environment variables.
 * Expects DB_1_NAME, DB_1_HOST, DB_1_PORT, DB_1_USER, DB_1_PASSWORD
 * through DB_5_NAME, DB_5_HOST, DB_5_PORT, DB_5_USER, DB_5_PASSWORD.
 */
export function getDatabaseConfigs(): DatabaseConfig[] {
  const configs: DatabaseConfig[] = [];

  for (let i = 1; i <= 10; i++) {
    const name = process.env[`DB_${i}_NAME`];
    const host = process.env[`DB_${i}_HOST`];
    const port = process.env[`DB_${i}_PORT`];
    const user = process.env[`DB_${i}_USER`];
    const password = process.env[`DB_${i}_PASSWORD`];

    if (name && host && user && password) {
      configs.push({
        name,
        host,
        port: port ? parseInt(port, 10) : 5432,
        user,
        password,
        database: name,
      });
    }
  }

  return configs;
}

/**
 * Find the configuration for a specific database by name.
 */
function findConfig(dbName: string): DatabaseConfig | undefined {
  return getDatabaseConfigs().find((c) => c.name === dbName);
}

/**
 * Get or create a connection pool for the given database name.
 * Pools are cached so subsequent calls reuse the same pool.
 */
export function getPool(dbName: string): Pool {
  const existing = pools.get(dbName);
  if (existing) {
    return existing;
  }

  const config = findConfig(dbName);
  if (!config) {
    throw new Error(
      `Database "${dbName}" is not configured. Check your environment variables.`
    );
  }

  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };

  const pool = new Pool(poolConfig);

  pool.on("error", (err) => {
    console.error(`[db] Unexpected error on idle client for "${dbName}":`, err);
  });

  pools.set(dbName, pool);
  return pool;
}

/**
 * Execute a parameterized query against the named database.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  dbName: string,
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool(dbName);
  try {
    return await pool.query<T>(sql, params);
  } catch (error) {
    console.error(`[db] Query error on "${dbName}":`, error);
    throw error;
  }
}

/**
 * Test the connection to a specific database.
 * Returns true if the connection succeeds, or throws with a descriptive error.
 */
export async function testConnection(
  dbName: string
): Promise<{ ok: true; latencyMs: number }> {
  const pool = getPool(dbName);
  const start = Date.now();

  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    const latencyMs = Date.now() - start;
    return { ok: true, latencyMs };
  } finally {
    client.release();
  }
}

/**
 * Gracefully shut down all connection pools.
 * Useful for cleanup during server shutdown.
 */
export async function closeAllPools(): Promise<void> {
  const entries = Array.from(pools.entries());
  for (const [name, pool] of entries) {
    try {
      await pool.end();
    } catch (err) {
      console.error(`[db] Error closing pool for "${name}":`, err);
    }
    pools.delete(name);
  }
}
