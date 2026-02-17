import { Pool } from "pg";
import type { DbType } from "./drivers/types";

const TABLE = "database_connections";

let connPool: Pool | null = null;
let tableReady = false;

export interface StoredConnection {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  db_type: DbType;
  created_at: string;
}

function getPool(): Pool {
  if (connPool) return connPool;
  connPool = new Pool({
    host: process.env.HUBPANEL_DB_HOST || "localhost",
    port: parseInt(process.env.HUBPANEL_DB_PORT || "5432", 10),
    user: process.env.HUBPANEL_DB_USER || "hubpanel",
    password: process.env.HUBPANEL_DB_PASSWORD || "",
    database: process.env.HUBPANEL_DB_NAME || "hubpanel",
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return connPool;
}

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      host        TEXT NOT NULL,
      port        INTEGER NOT NULL DEFAULT 5432,
      username    TEXT NOT NULL,
      password    TEXT NOT NULL,
      database    TEXT NOT NULL,
      db_type     TEXT NOT NULL DEFAULT 'postgresql',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  tableReady = true;
}

/** List all stored connections. */
export async function listConnections(): Promise<StoredConnection[]> {
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, name, host, port, username, password, database, db_type, created_at
     FROM ${TABLE} ORDER BY name`
  );
  return rows as StoredConnection[];
}

/** Get a single connection by name. */
export async function getConnection(name: string): Promise<StoredConnection | null> {
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, name, host, port, username, password, database, db_type, created_at
     FROM ${TABLE} WHERE name = $1`,
    [name]
  );
  return (rows[0] as StoredConnection) ?? null;
}

/** Add a new connection. */
export async function addConnection(conn: {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  db_type: DbType;
}): Promise<StoredConnection> {
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO ${TABLE} (name, host, port, username, password, database, db_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [conn.name, conn.host, conn.port, conn.username, conn.password, conn.database, conn.db_type]
  );
  return rows[0] as StoredConnection;
}

/** Remove a connection by name. */
export async function removeConnection(name: string): Promise<boolean> {
  await ensureTable();
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM ${TABLE} WHERE name = $1`,
    [name]
  );
  return (result.rowCount ?? 0) > 0;
}

/** Test if we can connect to the given config. */
export async function testNewConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  db_type: DbType;
}): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();

  if (config.db_type === "mysql" || config.db_type === "mariadb") {
    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.default.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        connectTimeout: 5000,
      });
      await conn.query("SELECT 1");
      await conn.end();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  // PostgreSQL / Supabase
  const testPool = new Pool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await testPool.connect();
    await client.query("SELECT 1");
    client.release();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : "Connection failed" };
  } finally {
    await testPool.end();
  }
}
