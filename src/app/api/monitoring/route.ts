import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDriver, getDatabaseConfigs } from "@/lib/db";

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

    // Common monitoring data
    const [connections, slowQueries] = await Promise.all([
      driver.getActiveConnections(),
      driver.getSlowQueries(),
    ]);

    // PostgreSQL-specific monitoring
    if (config.type === "postgresql" || config.type === "supabase") {
      const [dbSizesResult, cacheHitResult, txnStatsResult, tableBloatResult] =
        await Promise.all([
          driver.query(`
            SELECT datname AS name, pg_size_pretty(pg_database_size(datname)) AS size,
                   pg_database_size(datname) AS size_bytes
            FROM pg_database WHERE datistemplate = false ORDER BY pg_database_size(datname) DESC
          `),
          driver.query(`
            SELECT sum(heap_blks_read) AS heap_read, sum(heap_blks_hit) AS heap_hit,
                   CASE WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
                   ELSE round(sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2) END AS ratio
            FROM pg_statio_user_tables
          `),
          driver.query(`
            SELECT xact_commit + xact_rollback AS total_transactions, xact_commit AS commits,
                   xact_rollback AS rollbacks, EXTRACT(EPOCH FROM (now() - stats_reset)) AS seconds_since_reset,
                   CASE WHEN EXTRACT(EPOCH FROM (now() - stats_reset)) > 0
                   THEN round(((xact_commit + xact_rollback) / EXTRACT(EPOCH FROM (now() - stats_reset)))::numeric, 2)
                   ELSE 0 END AS tps
            FROM pg_stat_database WHERE datname = current_database()
          `),
          driver.query(`
            SELECT schemaname AS schema, relname AS table, n_live_tup AS live_rows,
                   n_dead_tup AS dead_rows,
                   CASE WHEN n_live_tup > 0 THEN round((n_dead_tup::numeric / n_live_tup) * 100, 2) ELSE 0 END AS bloat_ratio,
                   last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
            FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 20
          `),
        ]);

      const cacheHit = cacheHitResult.rows[0] ?? { heap_read: 0, heap_hit: 0, ratio: 0 };
      const txnStats = txnStatsResult.rows[0] ?? { total_transactions: 0, commits: 0, rollbacks: 0, tps: 0 };

      return NextResponse.json({
        dbType: config.type,
        activeConnections: connections,
        connectionCount: connections.length,
        databaseSizes: dbSizesResult.rows,
        cacheHitRatio: {
          heapRead: Number(cacheHit.heap_read),
          heapHit: Number(cacheHit.heap_hit),
          ratio: Number(cacheHit.ratio),
        },
        transactions: {
          total: Number(txnStats.total_transactions),
          commits: Number(txnStats.commits),
          rollbacks: Number(txnStats.rollbacks),
          tps: Number(txnStats.tps),
        },
        slowQueries,
        tableBloat: tableBloatResult.rows,
      });
    }

    // MySQL/MariaDB monitoring
    return NextResponse.json({
      dbType: config.type,
      activeConnections: connections,
      connectionCount: connections.length,
      slowQueries,
      databaseSizes: [],
      cacheHitRatio: { heapRead: 0, heapHit: 0, ratio: 0 },
      transactions: { total: 0, commits: 0, rollbacks: 0, tps: 0 },
      tableBloat: [],
    });
  } catch (error) {
    console.error("[api/monitoring] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
