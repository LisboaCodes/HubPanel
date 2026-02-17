import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabaseConfigs, getDriver } from "@/lib/db";
import type { DbType } from "@/lib/drivers/types";
import { logActivity } from "@/lib/logger";

/**
 * POST - Create a new database on an existing server connection.
 *
 * Uses one of the already-configured database connections as the "host"
 * to issue CREATE DATABASE. For PostgreSQL this means connecting to
 * an existing PG instance and creating a new DB there.
 *
 * Body: { hostDb: string, newDbName: string, owner?: string }
 * - hostDb: name of an existing configured database (to connect through)
 * - newDbName: the name of the new database to create
 * - owner: optional owner role for the new database
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { hostDb, newDbName, owner } = body as {
      hostDb?: string;
      newDbName?: string;
      owner?: string;
    };

    if (!hostDb || !newDbName) {
      return NextResponse.json(
        { error: "Missing required fields: hostDb, newDbName" },
        { status: 400 }
      );
    }

    // Validate database name: only allow safe characters
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newDbName)) {
      return NextResponse.json(
        { error: "Invalid database name. Use only letters, numbers, and underscores. Must start with a letter or underscore." },
        { status: 400 }
      );
    }

    // Check it doesn't already exist in our config
    const existingConfigs = getDatabaseConfigs();
    if (existingConfigs.some((c) => c.name === newDbName)) {
      return NextResponse.json(
        { error: `Database "${newDbName}" already exists in configuration` },
        { status: 409 }
      );
    }

    const hostConfig = existingConfigs.find((c) => c.name === hostDb);
    if (!hostConfig) {
      return NextResponse.json(
        { error: `Host database "${hostDb}" not found` },
        { status: 404 }
      );
    }

    const driver = getDriver(hostDb);
    await driver.createDatabase(newDbName, owner);

    // Figure out the next available DB slot
    let nextSlot = 0;
    for (let i = 1; i <= 10; i++) {
      if (!process.env[`DB_${i}_NAME`]) {
        nextSlot = i;
        break;
      }
    }

    logActivity(
      session.user?.email ?? "unknown",
      hostDb,
      "CREATE_DATABASE",
      `Database "${newDbName}" created on ${hostConfig.host}:${hostConfig.port}`,
      `CREATE DATABASE ${newDbName}`
    );

    return NextResponse.json({
      message: `Database "${newDbName}" created successfully`,
      database: newDbName,
      host: hostConfig.host,
      port: hostConfig.port,
      type: hostConfig.type,
      envSlot: nextSlot > 0 ? nextSlot : null,
      envVars: nextSlot > 0 ? {
        [`DB_${nextSlot}_NAME`]: newDbName,
        [`DB_${nextSlot}_HOST`]: hostConfig.host,
        [`DB_${nextSlot}_PORT`]: String(hostConfig.port),
        [`DB_${nextSlot}_USER`]: hostConfig.user,
        [`DB_${nextSlot}_PASSWORD`]: hostConfig.password,
        [`DB_${nextSlot}_TYPE`]: hostConfig.type,
      } : null,
      note: nextSlot > 0
        ? `Add the env vars above to Coolify to make this database accessible in HubPanel.`
        : `All 10 database slots are in use. Remove one or increase the limit.`,
    }, { status: 201 });
  } catch (error) {
    console.error("[api/databases/manage] POST Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Drop a database from an existing server connection.
 *
 * Body: { hostDb: string, dbName: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { hostDb, dbName } = body as { hostDb?: string; dbName?: string };

    if (!hostDb || !dbName) {
      return NextResponse.json(
        { error: "Missing required fields: hostDb, dbName" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
      return NextResponse.json(
        { error: "Invalid database name format" },
        { status: 400 }
      );
    }

    // Safety: prevent dropping the host database itself or known critical ones
    const protectedDbs = ["postgres", "template0", "template1", "hubpanel", hostDb];
    if (protectedDbs.includes(dbName)) {
      return NextResponse.json(
        { error: `Cannot drop protected database "${dbName}"` },
        { status: 403 }
      );
    }

    const driver = getDriver(hostDb);
    await driver.dropDatabase(dbName);

    logActivity(
      session.user?.email ?? "unknown",
      hostDb,
      "DROP_DATABASE",
      `Database "${dbName}" dropped`,
      `DROP DATABASE ${dbName}`
    );

    return NextResponse.json({
      message: `Database "${dbName}" dropped successfully`,
    });
  } catch (error) {
    console.error("[api/databases/manage] DELETE Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
