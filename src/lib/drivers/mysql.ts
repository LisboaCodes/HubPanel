import mysql, { Pool, PoolOptions, RowDataPacket, FieldPacket } from "mysql2/promise";
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

/** Quote a MySQL identifier with backticks. */
function ident(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

export class MySQLDriver implements DatabaseDriver {
  readonly type: DbType;
  private pool: Pool;
  private database: string;

  constructor(config: PoolOptions & { database: string }, dbType: DbType = "mysql") {
    this.type = dbType; // "mysql" or "mariadb"
    this.database = config.database;
    this.pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    });
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const [rows, fields] = await this.pool.query<RowDataPacket[]>(sql, params);
    const fieldInfos: FieldInfo[] = (fields as FieldPacket[])?.map((f) => ({
      name: f.name,
      type: f.type?.toString(),
    })) ?? [];

    return {
      rows: rows as unknown as T[],
      fields: fieldInfos,
    };
  }

  async listTables(schema?: string): Promise<TableInfo[]> {
    const db = schema || this.database;
    const sql = `
      SELECT
        TABLE_NAME AS name,
        DATA_LENGTH + INDEX_LENGTH AS size_bytes,
        CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2), ' kB') AS size,
        TABLE_ROWS AS row_estimate
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME;
    `;
    const { rows } = await this.query<TableInfo>(sql, [db]);
    return rows;
  }

  async getTableStructure(schema: string, table: string): Promise<TableStructure> {
    const db = schema === "public" ? this.database : schema;

    // Columns
    const colSql = `
      SELECT
        COLUMN_NAME AS column_name,
        DATA_TYPE AS data_type,
        COLUMN_TYPE AS udt_name,
        CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
        NUMERIC_PRECISION AS numeric_precision,
        NUMERIC_SCALE AS numeric_scale,
        IS_NULLABLE AS is_nullable,
        COLUMN_DEFAULT AS column_default
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION;
    `;
    const { rows: columns } = await this.query(colSql, [db, table]);

    // Constraints
    const conSql = `
      SELECT
        CONSTRAINT_NAME AS constraint_name,
        CONSTRAINT_TYPE AS constraint_type,
        GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) AS columns_str
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.KEY_COLUMN_USAGE kcu
        USING (CONSTRAINT_SCHEMA, CONSTRAINT_NAME, TABLE_NAME)
      WHERE tc.TABLE_SCHEMA = ? AND tc.TABLE_NAME = ?
      GROUP BY CONSTRAINT_NAME, CONSTRAINT_TYPE
      ORDER BY CONSTRAINT_NAME;
    `;
    const { rows: rawConstraints } = await this.query(conSql, [db, table]);
    const constraints = rawConstraints.map((c: Record<string, unknown>) => ({
      constraint_name: String(c.constraint_name),
      constraint_type: c.constraint_type === "PRIMARY KEY" ? "p" :
                       c.constraint_type === "FOREIGN KEY" ? "f" :
                       c.constraint_type === "UNIQUE" ? "u" : String(c.constraint_type),
      columns: String(c.columns_str || "").split(","),
    }));

    // Indexes
    const idxSql = `
      SELECT
        INDEX_NAME AS index_name,
        NOT NON_UNIQUE AS is_unique,
        INDEX_NAME = 'PRIMARY' AS is_primary,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS definition
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      GROUP BY INDEX_NAME, NON_UNIQUE
      ORDER BY INDEX_NAME;
    `;
    const { rows: indexes } = await this.query(idxSql, [db, table]);

    return {
      columns: columns as unknown as TableStructure["columns"],
      constraints: constraints as unknown as TableStructure["constraints"],
      indexes: indexes as unknown as TableStructure["indexes"],
    };
  }

  async getTableData(schema: string, table: string, options: GetTableDataOptions = {}): Promise<TableDataResult> {
    const { page = 1, pageSize = 50, orderBy, orderDir = "ASC", filters = [] } = options;
    const db = schema === "public" ? this.database : schema;
    const qualifiedTable = `${ident(db)}.${ident(table)}`;
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    for (const f of filters) {
      if (f.operator === "IS NULL") {
        whereClauses.push(`${ident(f.column)} IS NULL`);
      } else if (f.operator === "IS NOT NULL") {
        whereClauses.push(`${ident(f.column)} IS NOT NULL`);
      } else if (f.operator === "ILIKE") {
        // MySQL uses LIKE which is case-insensitive by default with utf8
        params.push(f.value);
        whereClauses.push(`${ident(f.column)} LIKE ?`);
      } else {
        params.push(f.value);
        whereClauses.push(`${ident(f.column)} ${f.operator} ?`);
      }
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderStr = orderBy ? `ORDER BY ${ident(orderBy)} ${orderDir === "DESC" ? "DESC" : "ASC"}` : "";
    const offset = (page - 1) * pageSize;

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM ${qualifiedTable} ${whereStr};`;
    const { rows: countRows } = await this.query<{ total: number }>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `SELECT * FROM ${qualifiedTable} ${whereStr} ${orderStr} LIMIT ? OFFSET ?;`;
    const result = await this.query(dataSql, [...params, pageSize, offset]);

    return {
      rows: result.rows,
      fields: result.fields,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    const [versionResult] = await Promise.all([
      this.query<{ version: string }>("SELECT VERSION() AS version;"),
    ]);

    const version = versionResult.rows[0]?.version ?? "Unknown";

    // Get database size
    const sizeSql = `
      SELECT
        SUM(DATA_LENGTH + INDEX_LENGTH) AS db_size_bytes,
        CONCAT(ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2), ' MB') AS db_size
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?;
    `;
    const { rows: sizeRows } = await this.query(sizeSql, [this.database]);

    // Active connections
    const { rows: processRows } = await this.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM information_schema.PROCESSLIST;"
    );

    // Max connections
    const { rows: maxConnRows } = await this.query<{ Value: string }>(
      "SHOW VARIABLES LIKE 'max_connections';"
    );

    // Uptime
    const { rows: uptimeRows } = await this.query<{ Value: string }>(
      "SHOW STATUS LIKE 'Uptime';"
    );

    return {
      version,
      current_db: this.database,
      db_size: String(sizeRows[0]?.db_size ?? "0 bytes"),
      db_size_bytes: Number(sizeRows[0]?.db_size_bytes ?? 0),
      active_connections: Number(processRows[0]?.count ?? 0),
      max_connections: String(maxConnRows[0]?.Value ?? "0"),
      uptime: uptimeRows[0]?.Value ? `${Math.floor(Number(uptimeRows[0].Value) / 3600)}h` : undefined,
    };
  }

  async getActiveConnections(): Promise<ConnectionInfo[]> {
    const sql = `
      SELECT
        ID AS pid,
        USER AS user,
        DB AS \`database\`,
        HOST AS client_addr,
        '' AS application_name,
        COMMAND AS state,
        INFO AS query,
        TIME AS query_duration,
        '' AS backend_start,
        '' AS query_start
      FROM information_schema.PROCESSLIST
      WHERE DB IS NOT NULL
      ORDER BY TIME DESC;
    `;
    const { rows } = await this.query(sql);
    return rows as unknown as ConnectionInfo[];
  }

  async getSlowQueries(): Promise<Record<string, unknown>[]> {
    try {
      const sql = `
        SELECT * FROM mysql.slow_log
        ORDER BY start_time DESC LIMIT 20;
      `;
      const { rows } = await this.query(sql);
      return rows;
    } catch {
      return [];
    }
  }

  async getPrimaryKey(schema: string, table: string): Promise<string | null> {
    const db = schema === "public" ? this.database : schema;
    const sql = `
      SELECT COLUMN_NAME AS column_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION
      LIMIT 1;
    `;
    const { rows } = await this.query(sql, [db, table]);
    return rows.length > 0 ? String(rows[0].column_name) : null;
  }

  async insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const db = schema === "public" ? this.database : schema;
    const keys = Object.keys(data);
    if (keys.length === 0) throw new Error("No data provided for insert.");

    const columns = keys.map(ident).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => data[k]);

    const sql = `INSERT INTO ${ident(db)}.${ident(table)} (${columns}) VALUES (${placeholders});`;
    await this.query(sql, values);

    // MySQL doesn't have RETURNING, so fetch the inserted row
    const { rows } = await this.query(`SELECT * FROM ${ident(db)}.${ident(table)} ORDER BY LAST_INSERT_ID() LIMIT 1;`);
    return rows[0] ?? data;
  }

  async updateRow(schema: string, table: string, pk: string, pkValue: unknown, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const db = schema === "public" ? this.database : schema;
    const keys = Object.keys(data);
    if (keys.length === 0) throw new Error("No data provided for update.");

    const setClauses = keys.map((k) => `${ident(k)} = ?`).join(", ");
    const values = [...keys.map((k) => data[k]), pkValue];

    const sql = `UPDATE ${ident(db)}.${ident(table)} SET ${setClauses} WHERE ${ident(pk)} = ?;`;
    await this.query(sql, values);

    // Fetch updated row
    const { rows } = await this.query(`SELECT * FROM ${ident(db)}.${ident(table)} WHERE ${ident(pk)} = ?;`, [pkValue]);
    return rows[0] ?? null;
  }

  async deleteRow(schema: string, table: string, pk: string, pkValue: unknown): Promise<Record<string, unknown> | null> {
    const db = schema === "public" ? this.database : schema;

    // Fetch before delete
    const { rows: before } = await this.query(`SELECT * FROM ${ident(db)}.${ident(table)} WHERE ${ident(pk)} = ?;`, [pkValue]);

    const sql = `DELETE FROM ${ident(db)}.${ident(table)} WHERE ${ident(pk)} = ?;`;
    await this.query(sql, [pkValue]);
    return before[0] ?? null;
  }

  async createDatabase(dbName: string): Promise<void> {
    await this.query(`CREATE DATABASE ${ident(dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  }

  async dropDatabase(dbName: string): Promise<void> {
    await this.query(`DROP DATABASE IF EXISTS ${ident(dbName)};`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
