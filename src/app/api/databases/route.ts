import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabaseConfigs, getPool } from "@/lib/db";
import { getDatabaseStats, listTables } from "@/lib/queries";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configs = getDatabaseConfigs();
    const results = await Promise.all(
      configs.map(async (config) => {
        try {
          const pool = getPool(config.name);
          const stats = await getDatabaseStats(pool);
          const tables = await listTables(pool);

          return {
            name: config.name,
            host: config.host,
            port: config.port,
            size: stats.db_size ?? "0 bytes",
            tableCount: tables.length,
            activeConnections: stats.active_connections ?? 0,
            status: "online" as const,
          };
        } catch (err) {
          return {
            name: config.name,
            host: config.host,
            port: config.port,
            size: "N/A",
            tableCount: 0,
            activeConnections: 0,
            status: "offline" as const,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("[api/databases] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
