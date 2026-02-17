import { Pool, PoolConfig } from "pg";
import type {
  DatabaseDriver,
  DbType,
  QueryResult,
  FieldInfo,
  TableInfo,
  TableStructure,
  GetTableDataOptions,
  TableDataResult,
  DatabaseStats,
  ConnectionInfo,
} from "./types";

/** Quote a SQL identifier to prevent injection. */
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export class PostgresDriver implements DatabaseDriver {
  readonly type: DbType;
  private pool: Pool;

  constructor(config: PoolConfig, dbType: DbType = "postgresql") {
    this.type = dbType; // "postgresql" or "supabase"
    this.pool = new Pool({
      ...config,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.pool.on("error", (err) => {
      console.error(`[pg-driver] Unexpected error on idle client:`, err);
    });
  }

  /** Expose the raw pool for backward compatibility. */
  getPool(): Pool {
    return this.pool;
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows as T[],
      fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    };
  }

  async listTables(schema: string = "public"): Promise<TableInfo[]> {
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
    const { rows } = await this.pool.query(sql, [schema]);
    return rows as TableInfo[];
  }

  async getTableStructure(schema: string, table: string): Promise<TableStructure> {
    const colSql = `
      SELECT
        c.column_name, c.data_type, c.udt_name,
        c.character_maximum_length, c.numeric_precision, c.numeric_scale,
        c.is_nullable, c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position;
    `;
    const columns = (await this.pool.query(colSql, [schema, table])).rows;

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
      WHERE nsp.nspname = $1 AND rel.relname = $2
      GROUP BY con.conname, con.contype
      ORDER BY con.conname;
    `;
    const constraints = (await this.pool.query(conSql, [schema, table])).rows;

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
      WHERE n.nspname = $1 AND t.relname = $2
      ORDER BY i.relname;
    `;
    const indexes = (await this.pool.query(idxSql, [schema, table])).rows;

    return {
      columns: columns as TableStructure["columns"],
      constraints: constraints as TableStructure["constraints"],
      indexes: indexes as TableStructure["indexes"],
    };
  }

  async getTableData(schema: string, table: string, options: GetTableDataOptions = {}): Promise<TableDataResult> {
    const { page = 1, pageSize = 50, orderBy, orderDir = "ASC", filters = [] } = options;

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

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderStr = orderBy ? `ORDER BY ${ident(orderBy)} ${orderDir === "DESC" ? "DESC" : "ASC"}` : "";
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT count(*)::int AS total FROM ${qualifiedTable} ${whereStr};`;
    const { rows: countRows } = await this.pool.query(countSql, params);
    const total: number = countRows[0]?.total ?? 0;

    const dataSql = `SELECT * FROM ${qualifiedTable} ${whereStr} ${orderStr} LIMIT ${pageSize} OFFSET ${offset};`;
    const { rows, fields } = await this.pool.query(dataSql, params);

    return {
      rows,
      fields: fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
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
    const { rows } = await this.pool.query(sql);
    return (rows[0] as DatabaseStats) ?? {} as DatabaseStats;
  }

  async getActiveConnections(): Promise<ConnectionInfo[]> {
    const sql = `
      SELECT
        pid, usename AS user, datname AS database,
        client_addr, application_name, state, query,
        backend_start, query_start,
        now() - query_start AS query_duration
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
      ORDER BY query_start DESC NULLS LAST;
    `;
    const { rows } = await this.pool.query(sql);
    return rows as ConnectionInfo[];
  }

  async getSlowQueries(): Promise<Record<string, unknown>[]> {
    try {
      const sql = `
        SELECT queryid, query, calls, total_exec_time, mean_exec_time,
               min_exec_time, max_exec_time, rows
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC LIMIT 20;
      `;
      const { rows } = await this.pool.query(sql);
      return rows;
    } catch {
      return [];
    }
  }

  async getPrimaryKey(schema: string, table: string): Promise<string | null> {
    const sql = `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE i.indisprimary AND n.nspname = $1 AND c.relname = $2
      ORDER BY array_position(i.indkey, a.attnum)
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(sql, [schema, table]);
    return rows.length > 0 ? rows[0].column_name : null;
  }

  async insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const keys = Object.keys(data);
    if (keys.length === 0) throw new Error("No data provided for insert.");

    const columns = keys.map(ident).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map((k) => data[k]);

    const sql = `INSERT INTO ${ident(schema)}.${ident(table)} (${columns}) VALUES (${placeholders}) RETURNING *;`;
    const { rows } = await this.pool.query(sql, values);
    return rows[0];
  }

  async updateRow(schema: string, table: string, pk: string, pkValue: unknown, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) throw new Error("No data provided for update.");

    const setClauses = keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(", ");
    const values = [...keys.map((k) => data[k]), pkValue];

    const sql = `UPDATE ${ident(schema)}.${ident(table)} SET ${setClauses} WHERE ${ident(pk)} = $${values.length} RETURNING *;`;
    const { rows } = await this.pool.query(sql, values);
    return rows[0] ?? null;
  }

  async deleteRow(schema: string, table: string, pk: string, pkValue: unknown): Promise<Record<string, unknown> | null> {
    const sql = `DELETE FROM ${ident(schema)}.${ident(table)} WHERE ${ident(pk)} = $1 RETURNING *;`;
    const { rows } = await this.pool.query(sql, [pkValue]);
    return rows[0] ?? null;
  }

  async createDatabase(dbName: string, owner?: string): Promise<void> {
    const ownerClause = owner ? ` OWNER ${ident(owner)}` : "";
    await this.pool.query(`CREATE DATABASE ${ident(dbName)}${ownerClause};`);
  }

  async dropDatabase(dbName: string): Promise<void> {
    await this.pool.query(`DROP DATABASE IF EXISTS ${ident(dbName)};`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
