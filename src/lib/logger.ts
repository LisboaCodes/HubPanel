import { getDatabaseConfigs, getPool } from "./db";

const LOGS_TABLE = "hubpanel_logs";

let tableEnsured = false;

/**
 * Return the name of the first configured database, used to store logs.
 */
function getLogDbName(): string {
  const configs = getDatabaseConfigs();
  if (configs.length === 0) {
    throw new Error("[logger] No databases configured. Cannot store logs.");
  }
  return configs[0].name;
}

/**
 * Ensure the hubpanel_logs table exists in the first configured database.
 * Only runs the CREATE TABLE once per process lifetime.
 */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;

  const pool = getPool(getLogDbName());
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${LOGS_TABLE} (
      id            BIGSERIAL PRIMARY KEY,
      timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
      user_email    TEXT NOT NULL,
      database_name TEXT NOT NULL,
      operation     TEXT NOT NULL,
      details       TEXT,
      sql_query     TEXT
    );
  `);

  // Create an index on timestamp for efficient filtering.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_hubpanel_logs_timestamp
    ON ${LOGS_TABLE} (timestamp DESC);
  `);

  tableEnsured = true;
}

/**
 * Record an activity log entry.
 *
 * @param user       - Email of the user who performed the action.
 * @param database   - Name of the database the action was performed on.
 * @param operation  - Short operation label, e.g. "INSERT", "DELETE", "QUERY".
 * @param details    - Human-readable description of what happened.
 * @param sql        - (Optional) The SQL that was executed.
 */
export async function logActivity(
  user: string,
  database: string,
  operation: string,
  details: string,
  sql?: string
): Promise<void> {
  try {
    await ensureTable();
    const pool = getPool(getLogDbName());
    await pool.query(
      `INSERT INTO ${LOGS_TABLE} (user_email, database_name, operation, details, sql_query)
       VALUES ($1, $2, $3, $4, $5);`,
      [user, database, operation, details, sql ?? null]
    );
  } catch (error) {
    // Logging should never crash the main operation.
    console.error("[logger] Failed to write log entry:", error);
  }
}

export interface LogFilters {
  database?: string;
  user?: string;
  operation?: string;
  limit?: number;
  offset?: number;
}

/**
 * Retrieve activity log entries with optional filtering.
 */
export async function getLogs(filters: LogFilters = {}) {
  await ensureTable();
  const pool = getPool(getLogDbName());

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.database) {
    params.push(filters.database);
    conditions.push(`database_name = $${params.length}`);
  }

  if (filters.user) {
    params.push(filters.user);
    conditions.push(`user_email = $${params.length}`);
  }

  if (filters.operation) {
    params.push(filters.operation);
    conditions.push(`operation = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  params.push(limit);
  const limitParam = `$${params.length}`;

  params.push(offset);
  const offsetParam = `$${params.length}`;

  const sql = `
    SELECT id, timestamp, user_email, database_name, operation, details, sql_query
    FROM ${LOGS_TABLE}
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ${limitParam} OFFSET ${offsetParam};
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}
