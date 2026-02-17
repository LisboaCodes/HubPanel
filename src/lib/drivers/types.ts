/**
 * Database driver abstraction layer.
 * Supports PostgreSQL, MySQL/MariaDB, and Supabase (PG-compatible).
 */

export type DbType = "postgresql" | "mysql" | "mariadb" | "supabase";

export const DB_TYPE_LABELS: Record<DbType, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mariadb: "MariaDB",
  supabase: "Supabase",
};

export const DB_TYPE_COLORS: Record<DbType, string> = {
  postgresql: "blue",
  mysql: "orange",
  mariadb: "teal",
  supabase: "emerald",
};

export interface FieldInfo {
  name: string;
  dataTypeID?: number;
  type?: string;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  fields: FieldInfo[];
}

export interface TableInfo {
  name: string;
  size_bytes: number;
  size: string;
  row_estimate: number;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name?: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: string;
  column_default: string | null;
}

export interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  columns: string[];
}

export interface IndexInfo {
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  definition: string;
}

export interface TableStructure {
  columns: ColumnInfo[];
  constraints: ConstraintInfo[];
  indexes: IndexInfo[];
}

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

export interface TableDataResult {
  rows: Record<string, unknown>[];
  fields: FieldInfo[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DatabaseStats {
  version: string;
  current_db: string;
  db_size: string;
  db_size_bytes: number;
  active_connections: number;
  max_connections: string;
  started_at?: string;
  uptime?: string;
}

export interface ConnectionInfo {
  pid: number;
  user: string;
  database: string;
  client_addr: string;
  application_name: string;
  state: string;
  query: string;
  backend_start: string;
  query_start: string;
  query_duration: string;
}

export interface DatabaseDriver {
  readonly type: DbType;

  /** Execute a raw query with parameterized values. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /** List tables in a schema. */
  listTables(schema?: string): Promise<TableInfo[]>;

  /** Get detailed table structure. */
  getTableStructure(schema: string, table: string): Promise<TableStructure>;

  /** Get paginated, filterable table data. */
  getTableData(schema: string, table: string, options?: GetTableDataOptions): Promise<TableDataResult>;

  /** Get database-level statistics. */
  getDatabaseStats(): Promise<DatabaseStats>;

  /** Get currently active connections. */
  getActiveConnections(): Promise<ConnectionInfo[]>;

  /** Get slow queries (if available). */
  getSlowQueries(): Promise<Record<string, unknown>[]>;

  /** Discover primary key column for a table. */
  getPrimaryKey(schema: string, table: string): Promise<string | null>;

  /** Insert a row. Returns the inserted row. */
  insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Update a row by primary key. Returns the updated row. */
  updateRow(schema: string, table: string, pk: string, pkValue: unknown, data: Record<string, unknown>): Promise<Record<string, unknown> | null>;

  /** Delete a row by primary key. Returns the deleted row. */
  deleteRow(schema: string, table: string, pk: string, pkValue: unknown): Promise<Record<string, unknown> | null>;

  /** Create a new database on the server. */
  createDatabase(dbName: string, owner?: string): Promise<void>;

  /** Drop a database on the server. */
  dropDatabase(dbName: string): Promise<void>;

  /** Close the connection pool. */
  close(): Promise<void>;
}
