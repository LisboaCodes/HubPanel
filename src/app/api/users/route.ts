import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { logActivity } from "@/lib/logger";

/* ------------------------------------------------------------------ */
/*  GET - List PostgreSQL roles / users                                */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const db = searchParams.get("db");

    if (!db) {
      return NextResponse.json(
        { error: "Missing required query parameter: db" },
        { status: 400 }
      );
    }

    const pool = getPool(db);
    const result = await pool.query(
      `SELECT
         rolname AS username,
         rolsuper AS is_superuser,
         rolcreatedb AS can_create_db,
         rolcreaterole AS can_create_role,
         rolcanlogin AS can_login,
         rolreplication AS is_replication,
         rolconnlimit AS connection_limit,
         rolvaliduntil AS valid_until
       FROM pg_roles
       ORDER BY rolname`
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("[api/users] GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST - Create PostgreSQL user                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { database, username, password, permissions = [] } = body as {
      database?: string;
      username?: string;
      password?: string;
      permissions?: string[];
    };

    if (!database || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields: database, username, password" },
        { status: 400 }
      );
    }

    // Validate username: only allow alphanumeric and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      return NextResponse.json(
        { error: "Invalid username. Use only letters, numbers, and underscores." },
        { status: 400 }
      );
    }

    const pool = getPool(database);

    // Create the role with LOGIN privilege
    // Using parameterized approach where possible; role names can't be parameterized
    // so we validate strictly above
    await pool.query(
      `CREATE ROLE "${username}" WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}'`
    );

    // Apply permissions
    const allowedPermissions = [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "CREATE",
      "USAGE",
      "ALL PRIVILEGES",
    ];

    const validPerms = permissions.filter((p) =>
      allowedPermissions.includes(p.toUpperCase())
    );

    if (validPerms.length > 0) {
      const permStr = validPerms.join(", ");
      await pool.query(
        `GRANT ${permStr} ON ALL TABLES IN SCHEMA public TO "${username}"`
      );
    }

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "CREATE_USER",
      `User "${username}" created successfully`,
      `CREATE ROLE ${username}`
    );

    return NextResponse.json(
      { message: `User "${username}" created successfully` },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/users] POST Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE - Drop PostgreSQL user                                      */
/* ------------------------------------------------------------------ */

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { database, username } = body as {
      database?: string;
      username?: string;
    };

    if (!database || !username) {
      return NextResponse.json(
        { error: "Missing required fields: database, username" },
        { status: 400 }
      );
    }

    // Validate username
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      return NextResponse.json(
        { error: "Invalid username format" },
        { status: 400 }
      );
    }

    const pool = getPool(database);

    // Revoke all privileges first, then drop
    await pool.query(
      `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${username}"`
    );
    await pool.query(`DROP ROLE IF EXISTS "${username}"`);

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "DROP_USER",
      `User "${username}" dropped successfully`,
      `DROP ROLE ${username}`
    );

    return NextResponse.json({
      message: `User "${username}" dropped successfully`,
    });
  } catch (error) {
    console.error("[api/users] DELETE Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
