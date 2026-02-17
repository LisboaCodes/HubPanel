import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { testNewConnection } from "@/lib/connections";
import type { DbType } from "@/lib/drivers/types";

const VALID_DB_TYPES: DbType[] = ["postgresql", "mysql", "mariadb", "supabase"];

/**
 * POST /api/connections/test
 * Test a database connection without saving it.
 * Body: { host, port, username, password, database, db_type }
 * Returns: { ok, latencyMs, error? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { host, port, username, password, database, db_type } = body;

    // --- Validation ---
    if (!host || !port || !username || !password || !database || !db_type) {
      return NextResponse.json(
        { error: "Missing required fields: host, port, username, password, database, db_type" },
        { status: 400 }
      );
    }

    if (!VALID_DB_TYPES.includes(db_type as DbType)) {
      return NextResponse.json(
        { error: `Invalid db_type. Must be one of: ${VALID_DB_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const parsedPort = typeof port === "string" ? parseInt(port, 10) : port;
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return NextResponse.json(
        { error: "Invalid port number. Must be between 1 and 65535." },
        { status: 400 }
      );
    }

    // --- Test the connection ---
    const result = await testNewConnection({
      host,
      port: parsedPort,
      username,
      password,
      database,
      db_type: db_type as DbType,
    });

    return NextResponse.json({
      ok: result.ok,
      latencyMs: result.latencyMs,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error("[api/connections/test] POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
