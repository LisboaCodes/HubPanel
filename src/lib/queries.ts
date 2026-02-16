import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Quote a SQL identifier (schema, table, column name) to prevent injection. */
function ident(name: string): string {
  // Double any existing double-quotes and wrap in double-quotes.
  return `"${name.replace(/"/g, '""')}"`;
}

// ---------------------------------------------------------------------------
// Introspection
// ---------------------------------------------------------------------------

/** List all databases on the server with their sizes. */
export async function listDatabases(pool: Pool) {
  const sql = `
    SELECT
      d.datname AS name,
      pg_catalog.pg_get_userbyid(d.datdba) AS owner,
      pg_catalog.pg_encoding_to_char(d.encoding) AS encoding,
      pg_database_size(d.datname) AS size_bytes,
      pg_size_pretty(pg_database_size(d.datname)) AS size
    FROM pg_catalog.pg_database d
    WHERE d.datistemplate = false
    ORDER BY d.datname;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

/** List tables in a schema with row counts and sizes. */
export async function listTables(pool: Pool, schema: string = "public") {
  const sql = `
    SELECT
      t.tablename AS name,
      pg_total_relation_size(quote_ident($1) || '.' || quote_ident(t.tablename)) AS size_bytes,
      pg_size_pretty(pg_total_relation_size(quote_ident($1) || '.' || quote_ident(t.tablename))) AS size,
      COALESCE(s.n_live_tup, 0) AS row_estimate
    FROM pg_catalog.pg_tables t
    LEFT JOIN pg_stat_user_tables s
      ON s.schemaname = t.schemaname AND s.relname = t.tablename
    WHERE t.schemaname = $1
    ORDER BY t.tablename;
  `;
  const { rows } = await pool.query(sql, [schema]);
  return rows;
}

/** Get the full structure of a table: columns, types, constraints, indexes. */
export async function getTableStructure(
  pool: Pool,
  schema: string,
  table: string
) {
  // Columns
  const colSql = `
    SELECT
      c.column_name,
      c.data_type,
      c.udt_name,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable,
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = $1
      AND c.table_name   = $2
    ORDER BY c.ordinal_position;
  `;
  const columns = (await pool.query(colSql, [schema, table])).rows;

  // Constraints
  const conSql = `
    SELECT
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      array_agg(att.attname ORDER BY u.pos) AS columns
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, pos)
    JOIN pg_catalog.pg_attribute att
      ON att.attrelid = rel.oid AND att.attnum = u.attnum
    WHERE nsp.nspname = $1
      AND rel.relname = $2
    GROUP BY con.conname, con.contype
    ORDER BY con.conname;
  `;
  const constraints = (await pool.query(conSql, [schema, table])).rows;

  // Indexes
  const idxSql = `
    SELECT
      i.relname AS index_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary,
      pg_get_indexdef(ix.indexrelid) AS definition
    FROM pg_catalog.pg_index ix
    JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
    JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = $1
      AND t.relname = $2
    ORDER BY i.relname;
  `;
  const indexes = (await pool.query(idxSql, [schema, table])).rows;

  return { columns, constraints, indexes };
}

// ---------------------------------------------------------------------------
// Data browsing (paginated, filterable)
// ---------------------------------------------------------------------------

export interface DataFilter {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "ILIKE" | "IS NULL" | "IS NOT NULL";
  value?: string;
}

export interface GetTableDataOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  filters?: DataFilter[];
}

export async function getTableData(
  pool: Pool,
  schema: string,
  table: string,
  options: GetTableDataOptions = {}
) {
  const {
    page = 1,
    pageSize = 50,
    orderBy,
    orderDir = "ASC",
    filters = [],
  } = options;

  const qualifiedTable = `${ident(schema)}.${ident(table)}`;
  const params: unknown[] = [];
  const whereClauses: string[] = [];

  for (const f of filters) {
    if (f.operator === "IS NULL") {
      whereClauses.push(`${ident(f.column)} IS NULL`);
    } else if (f.operator === "IS NOT NULL") {
      whereClauses.push(`${ident(f.column)} IS NOT NULL`);
    } else {
      params.push(f.value);
      whereClauses.push(`${ident(f.column)} ${f.operator} $${params.length}`);
    }
  }

  const whereStr =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const orderStr = orderBy
    ? `ORDER BY ${ident(orderBy)} ${orderDir === "DESC" ? "DESC" : "ASC"}`
    : "";

  const offset = (page - 1) * pageSize;

  // Total count
  const countSql = `SELECT count(*)::int AS total FROM ${qualifiedTable} ${whereStr};`;
  const { rows: countRows } = await pool.query(countSql, params);
  const total: number = countRows[0]?.total ?? 0;

  // Data rows
  const dataSql = `
    SELECT * FROM ${qualifiedTable}
    ${whereStr}
    ${orderStr}
    LIMIT ${pageSize} OFFSET ${offset};
  `;
  const { rows, fields } = await pool.query(dataSql, params);

  return {
    rows,
    fields: fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// Database stats
// ---------------------------------------------------------------------------

export async function getDatabaseStats(pool: Pool) {
  const sql = `
    SELECT
      version() AS version,
      current_database() AS current_db,
      pg_size_pretty(pg_database_size(current_database())) AS db_size,
      pg_database_size(current_database()) AS db_size_bytes,
      (SELECT count(*)::int FROM pg_stat_activity) AS active_connections,
      (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max_connections,
      pg_postmaster_start_time() AS started_at,
      now() - pg_postmaster_start_time() AS uptime;
  `;
  const { rows } = await pool.query(sql);
  return rows[0] ?? null;
}

/** Return current active connections from pg_stat_activity. */
export async function getActiveConnections(pool: Pool) {
  const sql = `
    SELECT
      pid,
      usename AS user,
      datname AS database,
      client_addr,
      application_name,
      state,
      query,
      backend_start,
      query_start,
      now() - query_start AS query_duration
    FROM pg_stat_activity
    WHERE datname IS NOT NULL
    ORDER BY query_start DESC NULLS LAST;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

/**
 * Return slow queries from pg_stat_statements if the extension is available.
 * Falls back gracefully when the extension is not installed.
 */
export async function getSlowQueries(pool: Pool) {
  try {
    const sql = `
      SELECT
        queryid,
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        min_exec_time,
        max_exec_time,
        rows
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT 20;
    `;
    const { rows } = await pool.query(sql);
    return rows;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Primary key discovery
// ---------------------------------------------------------------------------

/** Get the primary key column name(s) for a given table. */
export async function getPrimaryKey(
  pool: Pool,
  schema: string,
  table: string
): Promise<string | null> {
  const sql = `
    SELECT a.attname AS column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE i.indisprimary
      AND n.nspname = $1
      AND c.relname = $2
    ORDER BY array_position(i.indkey, a.attnum)
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [schema, table]);
  return rows.length > 0 ? rows[0].column_name : null;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/** Insert a new row into a table. Returns the inserted row. */
export async function insertRow(
  pool: Pool,
  schema: string,
  table: string,
  data: Record<string, unknown>
) {
  const keys = Object.keys(data);
  if (keys.length === 0) {
    throw new Error("No data provided for insert.");
  }

  const columns = keys.map(ident).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map((k) => data[k]);

  const sql = `
    INSERT INTO ${ident(schema)}.${ident(table)} (${columns})
    VALUES (${placeholders})
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

/** Update a row identified by its primary key. Returns the updated row. */
export async function updateRow(
  pool: Pool,
  schema: string,
  table: string,
  primaryKey: string,
  pkValue: unknown,
  data: Record<string, unknown>
) {
  const keys = Object.keys(data);
  if (keys.length === 0) {
    throw new Error("No data provided for update.");
  }

  const setClauses = keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(", ");
  const values = [...keys.map((k) => data[k]), pkValue];

  const sql = `
    UPDATE ${ident(schema)}.${ident(table)}
    SET ${setClauses}
    WHERE ${ident(primaryKey)} = $${values.length}
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, values);
  return rows[0] ?? null;
}

/** Delete a row identified by its primary key. Returns the deleted row. */
export async function deleteRow(
  pool: Pool,
  schema: string,
  table: string,
  primaryKey: string,
  pkValue: unknown
) {
  const sql = `
    DELETE FROM ${ident(schema)}.${ident(table)}
    WHERE ${ident(primaryKey)} = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [pkValue]);
  return rows[0] ?? null;
}
