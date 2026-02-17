import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDriver } from "@/lib/db";
import type { DataFilter } from "@/lib/drivers/types";
import { logActivity } from "@/lib/logger";

/* ------------------------------------------------------------------ */
/*  GET - Paginated table data                                         */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const db = searchParams.get("db");
    const schema = searchParams.get("schema") ?? "public";
    const table = searchParams.get("table");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10);
    const orderBy = searchParams.get("orderBy") ?? undefined;
    const orderDir = searchParams.get("orderDir") ?? "ASC";
    const filterParam = searchParams.get("filter");

    if (!db || !table) {
      return NextResponse.json(
        { error: "Missing required query parameters: db, table" },
        { status: 400 }
      );
    }

    let filters: DataFilter[] = [];
    if (filterParam) {
      try {
        filters = JSON.parse(filterParam);
      } catch {
        return NextResponse.json(
          { error: "Invalid filter JSON" },
          { status: 400 }
        );
      }
    }

    const driver = getDriver(db);
    const data = await driver.getTableData(schema, table, {
      page,
      pageSize,
      orderBy,
      orderDir: orderDir === "DESC" ? "DESC" : "ASC",
      filters,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/tables/data] GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST - Insert row                                                  */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { database, schema = "public", table, data } = body as {
      database?: string;
      schema?: string;
      table?: string;
      data?: Record<string, unknown>;
    };

    if (!database || !table || !data) {
      return NextResponse.json(
        { error: "Missing required fields: database, table, data" },
        { status: 400 }
      );
    }

    const driver = getDriver(database);
    const row = await driver.insertRow(schema, table, data);

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "INSERT",
      `Row inserted into ${schema}.${table}`,
      `INSERT INTO ${schema}.${table}`
    );

    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    console.error("[api/tables/data] POST Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  PUT - Update row                                                   */
/* ------------------------------------------------------------------ */

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { database, schema = "public", table, primaryKey, pkValue, data } =
      body as {
        database?: string;
        schema?: string;
        table?: string;
        primaryKey?: string;
        pkValue?: unknown;
        data?: Record<string, unknown>;
      };

    if (!database || !table || !primaryKey || pkValue === undefined || !data) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: database, table, primaryKey, pkValue, data",
        },
        { status: 400 }
      );
    }

    const driver = getDriver(database);
    const row = await driver.updateRow(schema, table, primaryKey, pkValue, data);

    if (!row) {
      return NextResponse.json(
        { error: "Row not found or not updated" },
        { status: 404 }
      );
    }

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "UPDATE",
      `Row updated in ${schema}.${table}`,
      `UPDATE ${schema}.${table} WHERE ${primaryKey} = ${pkValue}`
    );

    return NextResponse.json({ row });
  } catch (error) {
    console.error("[api/tables/data] PUT Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE - Delete row                                                */
/* ------------------------------------------------------------------ */

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { database, schema = "public", table, primaryKey, pkValue } = body as {
      database?: string;
      schema?: string;
      table?: string;
      primaryKey?: string;
      pkValue?: unknown;
    };

    if (!database || !table || !primaryKey || pkValue === undefined) {
      return NextResponse.json(
        {
          error: "Missing required fields: database, table, primaryKey, pkValue",
        },
        { status: 400 }
      );
    }

    const driver = getDriver(database);
    const row = await driver.deleteRow(schema, table, primaryKey, pkValue);

    if (!row) {
      return NextResponse.json(
        { error: "Row not found or not deleted" },
        { status: 404 }
      );
    }

    logActivity(
      session.user?.email ?? "unknown",
      database,
      "DELETE",
      `Row deleted from ${schema}.${table}`,
      `DELETE FROM ${schema}.${table} WHERE ${primaryKey} = ${pkValue}`
    );

    return NextResponse.json({ row });
  } catch (error) {
    console.error("[api/tables/data] DELETE Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
