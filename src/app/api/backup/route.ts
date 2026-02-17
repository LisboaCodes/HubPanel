import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDriver, getDatabaseConfigs } from "@/lib/db";
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

    const config = getDatabaseConfigs().find((c) => c.name === database);
    if (!config) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const driver = getDriver(database);
    const lines: string[] = [];

    // Header
    lines.push("--");
    lines.push(`-- HubPanel SQL Dump`);
    lines.push(`-- Database: ${database} (${config.type})`);
    lines.push(`-- Generated at: ${new Date().toISOString()}`);
    lines.push("--");
    lines.push("");

    if (config.type === "mysql" || config.type === "mariadb") {
      lines.push("SET FOREIGN_KEY_CHECKS = 0;");
      lines.push("");

      const tables = await driver.listTables();
      for (const t of tables) {
        const tableName = t.name;
        lines.push(`-- Table: ${tableName}`);
        lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);

        // Get CREATE TABLE statement
        try {
          const { rows } = await driver.query(`SHOW CREATE TABLE \`${tableName}\``);
          if (rows[0]) {
            const createSql = (rows[0] as Record<string, unknown>)["Create Table"] as string;
            lines.push(createSql + ";");
          }
        } catch { /* skip */ }

        // Data
        const { rows: dataRows, fields } = await driver.query(`SELECT * FROM \`${tableName}\` LIMIT 50000`);
        for (const row of dataRows) {
          const vals = fields.map((f) => {
            const val = (row as Record<string, unknown>)[f.name];
            if (val === null || val === undefined) return "NULL";
            if (typeof val === "number" || typeof val === "boolean") return String(val);
            const escaped = String(val).replace(/'/g, "''");
            return `'${escaped}'`;
          }).join(", ");
          const cols = fields.map((f) => `\`${f.name}\``).join(", ");
          lines.push(`INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});`);
        }
        lines.push("");
      }

      lines.push("SET FOREIGN_KEY_CHECKS = 1;");
    } else {
      // PostgreSQL / Supabase
      lines.push("BEGIN;");
      lines.push("");

      const tables = await driver.listTables();
      for (const t of tables) {
        const tableName = t.name;
        const structure = await driver.getTableStructure("public", tableName);

        lines.push(`-- Table: ${tableName}`);
        lines.push(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        lines.push(`CREATE TABLE "${tableName}" (`);

        const colDefs: string[] = [];
        for (const col of structure.columns) {
          let typeDef = col.data_type;
          if (col.character_maximum_length) typeDef += `(${col.character_maximum_length})`;
          let colLine = `  "${col.column_name}" ${typeDef}`;
          if (col.is_nullable === "NO") colLine += " NOT NULL";
          if (col.column_default) colLine += ` DEFAULT ${col.column_default}`;
          colDefs.push(colLine);
        }

        const pkConstraint = structure.constraints.find((c) => c.constraint_type === "p");
        if (pkConstraint) {
          const pkCols = pkConstraint.columns.map((c: string) => `"${c}"`).join(", ");
          colDefs.push(`  PRIMARY KEY (${pkCols})`);
        }

        lines.push(colDefs.join(",\n"));
        lines.push(");");
        lines.push("");

        // Data
        const { rows: dataRows, fields } = await driver.query(`SELECT * FROM "${tableName}" LIMIT 50000`);
        if (dataRows.length > 0) {
          const cols = fields.map((f) => `"${f.name}"`).join(", ");
          for (const row of dataRows) {
            const vals = fields.map((f) => {
              const val = (row as Record<string, unknown>)[f.name];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "number" || typeof val === "boolean") return String(val);
              if (val instanceof Date) return `'${val.toISOString()}'`;
              const escaped = String(val).replace(/'/g, "''");
              return `'${escaped}'`;
            }).join(", ");
            lines.push(`INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`);
          }
          lines.push("");
        }
      }

      lines.push("COMMIT;");
    }

    lines.push("");
    const sqlDump = lines.join("\n");

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "BACKUP",
      "Backup created successfully",
      `Backup for ${database} (${config.type})`
    );

    return new NextResponse(sqlDump, {
      status: 200,
      headers: {
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="${database}_backup_${Date.now()}.sql"`,
      },
    });
  } catch (error) {
    console.error("[api/backup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
