import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  addConnection,
  removeConnection,
  testNewConnection,
  listConnections,
} from "@/lib/connections";
import { invalidateStoredConfigsCache } from "@/lib/db";
import { logActivity } from "@/lib/logger";
import type { DbType } from "@/lib/drivers/types";

const VALID_DB_TYPES: DbType[] = ["postgresql", "mysql", "mariadb", "supabase"];
const NAME_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * GET /api/connections
 * List all stored connections (passwords masked).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connections = await listConnections();

    // Mask passwords before returning
    const safe = connections.map((conn) => ({
      ...conn,
      password: "***",
    }));

    return NextResponse.json(safe);
  } catch (error) {
    console.error("[api/connections] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections
 * Add a new connection. Tests the connection first before saving.
 * Body: { name, host, port, username, password, database, db_type }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, host, port, username, password, database, db_type } = body;

    // --- Validation ---
    if (!name || !host || !port || !username || !password || !database || !db_type) {
      return NextResponse.json(
        { error: "Missing required fields: name, host, port, username, password, database, db_type" },
        { status: 400 }
      );
    }

    if (!NAME_REGEX.test(name)) {
      return NextResponse.json(
        { error: "Invalid name. Only alphanumeric characters and underscores are allowed." },
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

    // --- Test connection before saving ---
    const testResult = await testNewConnection({
      host,
      port: parsedPort,
      username,
      password,
      database,
      db_type: db_type as DbType,
    });

    if (!testResult.ok) {
      return NextResponse.json(
        {
          error: "Connection test failed. The connection was not saved.",
          details: testResult.error,
          latencyMs: testResult.latencyMs,
        },
        { status: 422 }
      );
    }

    // --- Save connection ---
    const saved = await addConnection({
      name,
      host,
      port: parsedPort,
      username,
      password,
      database,
      db_type: db_type as DbType,
    });

    // Invalidate cache so the new connection is immediately available
    invalidateStoredConfigsCache();

    // Log the activity
    const userEmail = session.user?.email ?? "unknown";
    await logActivity(
      userEmail,
      "hubpanel",
      "ADD_CONNECTION",
      `Added connection "${name}" (${db_type}) -> ${host}:${parsedPort}/${database}`
    );

    return NextResponse.json(
      {
        ...saved,
        password: "***",
        testLatencyMs: testResult.latencyMs,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/connections] POST error:", error);

    // Handle duplicate name
    const msg = error instanceof Error ? error.message : "Internal server error";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "A connection with this name already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/connections
 * Remove a stored connection by name.
 * Body: { name }
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const removed = await removeConnection(name);

    if (!removed) {
      return NextResponse.json(
        { error: `Connection "${name}" not found.` },
        { status: 404 }
      );
    }

    // Invalidate cache so the removal is immediately reflected
    invalidateStoredConfigsCache();

    // Log the activity
    const userEmail = session.user?.email ?? "unknown";
    await logActivity(
      userEmail,
      "hubpanel",
      "REMOVE_CONNECTION",
      `Removed connection "${name}"`
    );

    return NextResponse.json({ ok: true, message: `Connection "${name}" removed.` });
  } catch (error) {
    console.error("[api/connections] DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
