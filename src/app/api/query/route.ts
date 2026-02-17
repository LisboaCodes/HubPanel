import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDriver } from "@/lib/db";
import { logActivity } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { database, sql } = body as { database?: string; sql?: string };

    if (!database || !sql) {
      return NextResponse.json(
        { error: "Missing required fields: database, sql" },
        { status: 400 }
      );
    }

    const driver = getDriver(database);
    const start = performance.now();

    try {
      const result = await driver.query(sql);
      const duration = Math.round((performance.now() - start) * 100) / 100;

      logActivity(
        session.user?.email ?? "unknown",
        database,
        "QUERY",
        `Query executed successfully in ${duration}ms`,
        sql
      );

      return NextResponse.json({
        rows: result.rows,
        rowCount: result.rows.length,
        fields: result.fields,
        duration,
      });
    } catch (queryError) {
      const duration = Math.round((performance.now() - start) * 100) / 100;
      const errorMessage =
        queryError instanceof Error ? queryError.message : "Query execution failed";

      logActivity(
        session.user?.email ?? "unknown",
        database,
        "QUERY",
        `Query failed (${duration}ms): ${errorMessage}`,
        sql
      );

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
  } catch (error) {
    console.error("[api/query] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
