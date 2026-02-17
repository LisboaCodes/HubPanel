import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabaseConfigs, getDriver } from "@/lib/db";

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
          const driver = getDriver(config.name);
          const stats = await driver.getDatabaseStats();
          const tables = await driver.listTables();

          return {
            name: config.name,
            host: config.host,
            port: config.port,
            type: config.type,
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
            type: config.type,
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
