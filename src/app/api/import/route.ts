import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDriverAsync } from "@/lib/db";
import { logActivity } from "@/lib/logger";

/**
 * Split a SQL dump into individual statements, respecting quoted strings,
 * dollar-quoted blocks (PostgreSQL), and line comments.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inDollarQuote) {
      current += ch;
      if (ch === "$" && sql.substring(i).startsWith(dollarTag)) {
        current += sql.substring(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        inDollarQuote = false;
      }
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (ch === "$" && next === "$") {
        // PostgreSQL dollar quoting
        dollarTag = "$$";
        inDollarQuote = true;
        current += ch;
        continue;
      }

      if (ch === "-" && next === "-") {
        // Skip line comments
        const eol = sql.indexOf("\n", i);
        i = eol === -1 ? sql.length : eol;
        continue;
      }

      if (ch === ";") {
        const stmt = current.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        current = "";
        continue;
      }
    }

    current += ch;
  }

  const last = current.trim();
  if (last.length > 0) statements.push(last);
  return statements;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const database = formData.get("database") as string | null;
    const file = formData.get("file") as File | null;

    if (!database) {
      return NextResponse.json(
        { error: "Missing required field: database" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "Missing required field: file" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".sql")) {
      return NextResponse.json(
        { error: "Only .sql files are accepted" },
        { status: 400 }
      );
    }

    const driver = await getDriverAsync(database);
    const sqlContent = await file.text();
    const statements = splitStatements(sqlContent);

    if (statements.length === 0) {
      return NextResponse.json(
        { error: "No SQL statements found in the uploaded file" },
        { status: 400 }
      );
    }

    let statementsExecuted = 0;
    const errors: string[] = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await driver.query(stmt);
        statementsExecuted++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        errors.push(`Statement ${i + 1}: ${message}`);
      }
    }

    const userEmail = session.user?.email ?? "unknown";

    logActivity(
      userEmail,
      database,
      "IMPORT",
      `SQL import completed: ${statementsExecuted}/${statements.length} statements executed, ${errors.length} error(s). File: ${file.name}`,
      `-- Import from file: ${file.name}\n-- Total statements: ${statements.length}`
    );

    return NextResponse.json({
      success: true,
      statementsExecuted,
      errors,
    });
  } catch (error) {
    console.error("[api/import] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
