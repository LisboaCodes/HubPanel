import { Pool, PoolConfig, QueryResult } from "pg";
import type { DbType, DatabaseDriver } from "./drivers/types";
import { PostgresDriver } from "./drivers/postgres";
import { MySQLDriver } from "./drivers/mysql";
import { listConnections, type StoredConnection } from "./connections";

export interface DatabaseConfig {
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  type: DbType;
  source: "env" | "stored";
}

const pools: Map<string, Pool> = new Map();
const drivers: Map<string, DatabaseDriver> = new Map();

/** Cache for stored connections to avoid hitting DB every time. */
let storedConfigsCache: DatabaseConfig[] | null = null;
let storedConfigsCacheTime = 0;
const CACHE_TTL = 10_000; // 10 seconds

/**
 * Read all database configurations from environment variables.
 * Expects DB_X_NAME, DB_X_HOST, DB_X_PORT, DB_X_USER, DB_X_PASSWORD, DB_X_TYPE
 * for X from 1 to 10.
 */
/** Read database configs from environment variables only (sync). */
export function getDatabaseConfigs(): DatabaseConfig[] {
  const configs: DatabaseConfig[] = [];

  for (let i = 1; i <= 10; i++) {
    const name = process.env[`DB_${i}_NAME`];
    const host = process.env[`DB_${i}_HOST`];
    const port = process.env[`DB_${i}_PORT`];
    const user = process.env[`DB_${i}_USER`];
    const password = process.env[`DB_${i}_PASSWORD`];
    const rawType = process.env[`DB_${i}_TYPE`] ?? "postgresql";

    if (name && host && user && password) {
      const type = (["postgresql", "mysql", "mariadb", "supabase"].includes(rawType)
        ? rawType
        : "postgresql") as DbType;

      configs.push({
        name,
        host,
        port: port ? parseInt(port, 10) : (type === "mysql" || type === "mariadb" ? 3306 : 5432),
        user,
        password,
        database: name,
        type,
        source: "env",
      });
    }
  }

  return configs;
}

/**
 * Get ALL database configs: env vars + stored connections from hubpanel DB.
 * This is async because it reads from the database.
 */
export async function getAllDatabaseConfigs(): Promise<DatabaseConfig[]> {
  const envConfigs = getDatabaseConfigs();

  try {
    const now = Date.now();
    if (!storedConfigsCache || now - storedConfigsCacheTime > CACHE_TTL) {
      const stored = await listConnections();
      storedConfigsCache = stored.map((s: StoredConnection) => ({
        name: s.name,
        host: s.host,
        port: s.port,
        user: s.username,
        password: s.password,
        database: s.database,
        type: s.db_type as DbType,
        source: "stored" as const,
      }));
      storedConfigsCacheTime = now;
    }

    // Merge: env configs take priority (by name)
    const envNames = new Set(envConfigs.map((c) => c.name));
    const storedOnly = (storedConfigsCache || []).filter((c) => !envNames.has(c.name));
    return [...envConfigs, ...storedOnly];
  } catch {
    // If stored connections can't be read, just return env configs
    return envConfigs;
  }
}

/** Invalidate the stored connections cache (call after add/remove). */
export function invalidateStoredConfigsCache(): void {
  storedConfigsCache = null;
  storedConfigsCacheTime = 0;
}

/**
 * Find the configuration for a specific database by name (sync, env only).
 */
function findConfig(dbName: string): DatabaseConfig | undefined {
  // First check env configs
  const envConfig = getDatabaseConfigs().find((c) => c.name === dbName);
  if (envConfig) return envConfig;

  // Check cached stored configs
  if (storedConfigsCache) {
    return storedConfigsCache.find((c) => c.name === dbName);
  }

  return undefined;
}

/**
 * Find config async (checks both env and stored).
 */
async function findConfigAsync(dbName: string): Promise<DatabaseConfig | undefined> {
  const all = await getAllDatabaseConfigs();
  return all.find((c) => c.name === dbName);
}

/**
 * Get or create a DatabaseDriver for the given database name.
 * Drivers are cached so subsequent calls reuse the same instance.
 * Checks both env vars and stored connections.
 */
export async function getDriverAsync(dbName: string): Promise<DatabaseDriver> {
  const existing = drivers.get(dbName);
  if (existing) return existing;

  const config = await findConfigAsync(dbName);
  if (!config) {
    throw new Error(`Database "${dbName}" is not configured.`);
  }

  return createDriver(dbName, config);
}

/**
 * Get or create a DatabaseDriver (sync version, env-only).
 */
export function getDriver(dbName: string): DatabaseDriver {
  const existing = drivers.get(dbName);
  if (existing) return existing;

  const config = findConfig(dbName);
  if (!config) {
    throw new Error(
      `Database "${dbName}" is not configured. Check your environment variables.`
    );
  }

  return createDriver(dbName, config);
}

function createDriver(dbName: string, config: DatabaseConfig): DatabaseDriver {
  let driver: DatabaseDriver;

  if (config.type === "mysql" || config.type === "mariadb") {
    driver = new MySQLDriver(
      {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
      },
      config.type
    );
  } else {
    driver = new PostgresDriver(
      {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
      },
      config.type
    );
  }

  drivers.set(dbName, driver);
  return driver;
}

/**
 * Get or create a pg Pool for the given database name (backward compatibility).
 * Only works for PostgreSQL/Supabase databases.
 */
export function getPool(dbName: string): Pool {
  const existing = pools.get(dbName);
  if (existing) return existing;

  const config = findConfig(dbName);
  if (!config) {
    throw new Error(
      `Database "${dbName}" is not configured. Check your environment variables.`
    );
  }

  if (config.type === "mysql" || config.type === "mariadb") {
    throw new Error(
      `Database "${dbName}" is of type ${config.type}. Use getDriver() instead of getPool().`
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
 */
export async function testConnection(
  dbName: string
): Promise<{ ok: true; latencyMs: number }> {
  const config = findConfig(dbName);
  if (!config) {
    throw new Error(`Database "${dbName}" is not configured.`);
  }

  const start = Date.now();
  const driver = getDriver(dbName);
  await driver.query("SELECT 1");
  const latencyMs = Date.now() - start;
  return { ok: true, latencyMs };
}

/**
 * Gracefully shut down all connection pools and drivers.
 */
export async function closeAllPools(): Promise<void> {
  // Close pg pools
  for (const [name, pool] of pools.entries()) {
    try { await pool.end(); } catch (err) {
      console.error(`[db] Error closing pool for "${name}":`, err);
    }
    pools.delete(name);
  }
  // Close drivers
  for (const [name, driver] of drivers.entries()) {
    try { await driver.close(); } catch (err) {
      console.error(`[db] Error closing driver for "${name}":`, err);
    }
    drivers.delete(name);
  }
}
