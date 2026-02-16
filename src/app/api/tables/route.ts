import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { listTables, getTableStructure } from "@/lib/queries";

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

    if (!db) {
      return NextResponse.json(
        { error: "Missing required query parameter: db" },
        { status: 400 }
      );
    }

    const pool = getPool(db);

    // If a specific table is requested, return its structure
    if (table) {
      const structure = await getTableStructure(pool, schema, table);
      return NextResponse.json(structure);
    }

    // Otherwise, list all tables in the schema
    const tables = await listTables(pool, schema);
    return NextResponse.json(tables);
  } catch (error) {
    console.error("[api/tables] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
