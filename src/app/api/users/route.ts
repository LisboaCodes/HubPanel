import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDriver, getDatabaseConfigs } from "@/lib/db";
import { logActivity } from "@/lib/logger";

/* ------------------------------------------------------------------ */
/*  GET - List database users/roles                                    */
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

    const config = getDatabaseConfigs().find((c) => c.name === db);
    if (!config) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const driver = getDriver(db);

    if (config.type === "mysql" || config.type === "mariadb") {
      const { rows } = await driver.query(
        `SELECT User AS username, Host AS host,
                IF(Super_priv = 'Y', true, false) AS is_superuser,
                IF(Create_priv = 'Y', true, false) AS can_create_db
         FROM mysql.user ORDER BY User`
      );
      return NextResponse.json(rows);
    }

    // PostgreSQL / Supabase
    const { rows } = await driver.query(
      `SELECT rolname AS username, rolsuper AS is_superuser,
              rolcreatedb AS can_create_db, rolcreaterole AS can_create_role,
              rolcanlogin AS can_login, rolreplication AS is_replication,
              rolconnlimit AS connection_limit, rolvaliduntil AS valid_until
       FROM pg_roles ORDER BY rolname`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[api/users] GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST - Create user                                                 */
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

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      return NextResponse.json(
        { error: "Invalid username. Use only letters, numbers, and underscores." },
        { status: 400 }
      );
    }

    const config = getDatabaseConfigs().find((c) => c.name === database);
    if (!config) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const driver = getDriver(database);
    const escapedPassword = password.replace(/'/g, "''");

    if (config.type === "mysql" || config.type === "mariadb") {
      await driver.query(`CREATE USER '${username}'@'%' IDENTIFIED BY '${escapedPassword}'`);
      const allowedPermissions = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALL PRIVILEGES"];
      const validPerms = permissions.filter((p) => allowedPermissions.includes(p.toUpperCase()));
      if (validPerms.length > 0) {
        await driver.query(`GRANT ${validPerms.join(", ")} ON ${database}.* TO '${username}'@'%'`);
        await driver.query("FLUSH PRIVILEGES");
      }
    } else {
      await driver.query(`CREATE ROLE "${username}" WITH LOGIN PASSWORD '${escapedPassword}'`);
      const allowedPermissions = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "USAGE", "ALL PRIVILEGES"];
      const validPerms = permissions.filter((p) => allowedPermissions.includes(p.toUpperCase()));
      if (validPerms.length > 0) {
        await driver.query(`GRANT ${validPerms.join(", ")} ON ALL TABLES IN SCHEMA public TO "${username}"`);
      }
    }

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "CREATE_USER",
      `User "${username}" created successfully`,
      `CREATE USER ${username}`
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
/*  DELETE - Drop user                                                 */
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

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      return NextResponse.json(
        { error: "Invalid username format" },
        { status: 400 }
      );
    }

    const config = getDatabaseConfigs().find((c) => c.name === database);
    if (!config) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const driver = getDriver(database);

    if (config.type === "mysql" || config.type === "mariadb") {
      await driver.query(`DROP USER IF EXISTS '${username}'@'%'`);
    } else {
      await driver.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${username}"`);
      await driver.query(`DROP ROLE IF EXISTS "${username}"`);
    }

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "DROP_USER",
      `User "${username}" dropped successfully`,
      `DROP USER ${username}`
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
