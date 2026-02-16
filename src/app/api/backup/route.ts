import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { logActivity } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { database } = body as { database?: string };

    if (!database) {
      return NextResponse.json(
        { error: "Missing required field: database" },
        { status: 400 }
      );
    }

    const pool = getPool(database);
    const lines: string[] = [];

    // Header
    lines.push("--");
    lines.push(`-- HubPanel SQL Dump`);
    lines.push(`-- Database: ${database}`);
    lines.push(`-- Generated at: ${new Date().toISOString()}`);
    lines.push("--");
    lines.push("");
    lines.push("BEGIN;");
    lines.push("");

    // Get all tables in public schema
    const tablesResult = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    for (const { tablename } of tablesResult.rows) {
      // CREATE TABLE statement
      const colsResult = await pool.query(
        `SELECT
           column_name,
           data_type,
           character_maximum_length,
           is_nullable,
           column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tablename]
      );

      lines.push(`-- Table: ${tablename}`);
      lines.push(`DROP TABLE IF EXISTS "${tablename}" CASCADE;`);
      lines.push(`CREATE TABLE "${tablename}" (`);

      const colDefs: string[] = [];
      for (const col of colsResult.rows) {
        let typeDef = col.data_type;
        if (col.character_maximum_length) {
          typeDef += `(${col.character_maximum_length})`;
        }

        let colLine = `  "${col.column_name}" ${typeDef}`;
        if (col.is_nullable === "NO") {
          colLine += " NOT NULL";
        }
        if (col.column_default) {
          colLine += ` DEFAULT ${col.column_default}`;
        }
        colDefs.push(colLine);
      }

      // Primary key constraint
      const pkResult = await pool.query(
        `SELECT a.attname
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         JOIN pg_class c ON c.oid = i.indrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE i.indisprimary AND n.nspname = 'public' AND c.relname = $1
         ORDER BY array_position(i.indkey, a.attnum)`,
        [tablename]
      );

      if (pkResult.rows.length > 0) {
        const pkCols = pkResult.rows
          .map((r: { attname: string }) => `"${r.attname}"`)
          .join(", ");
        colDefs.push(`  PRIMARY KEY (${pkCols})`);
      }

      lines.push(colDefs.join(",\n"));
      lines.push(");");
      lines.push("");

      // INSERT statements
      const dataResult = await pool.query(
        `SELECT * FROM "${tablename}" LIMIT 50000`
      );

      if (dataResult.rows.length > 0) {
        const columns = dataResult.fields
          .map((f) => `"${f.name}"`)
          .join(", ");

        for (const row of dataResult.rows) {
          const values = dataResult.fields
            .map((f) => {
              const val = row[f.name];
              if (val === null || val === undefined) {
                return "NULL";
              }
              if (typeof val === "number" || typeof val === "boolean") {
                return String(val);
              }
              if (val instanceof Date) {
                return `'${val.toISOString()}'`;
              }
              // Escape single quotes for string values
              const escaped = String(val).replace(/'/g, "''");
              return `'${escaped}'`;
            })
            .join(", ");

          lines.push(
            `INSERT INTO "${tablename}" (${columns}) VALUES (${values});`
          );
        }
        lines.push("");
      }
    }

    lines.push("COMMIT;");
    lines.push("");

    const sqlDump = lines.join("\n");

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "BACKUP",
      "Backup created successfully",
      `pg_dump simulation for ${database}`
    );

    // Return as downloadable SQL text
    return new NextResponse(sqlDump, {
      status: 200,
      headers: {
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="${database}_backup_${Date.now()}.sql"`,
      },
    });
  } catch (error) {
    console.error("[api/backup] Error:", error);

    logActivity(
      "unknown",
      "unknown",
      "BACKUP",
      `Backup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "pg_dump simulation"
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
