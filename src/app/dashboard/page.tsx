"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  TableProperties,
  Activity,
  Clock,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type DbType = "postgresql" | "mysql" | "mariadb" | "supabase";

const DB_TYPE_LABELS: Record<DbType, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mariadb: "MariaDB",
  supabase: "Supabase",
};

const DB_TYPE_COLORS: Record<DbType, string> = {
  postgresql: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  mysql: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  mariadb: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  supabase: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const DB_TYPE_DOT: Record<DbType, string> = {
  postgresql: "bg-blue-500",
  mysql: "bg-orange-500",
  mariadb: "bg-teal-500",
  supabase: "bg-emerald-500",
};

interface DatabaseInfo {
  name: string;
  host: string;
  port: number;
  type: DbType;
  size: string;
  tableCount: number;
  activeConnections: number;
  status: "online" | "offline";
  error?: string;
}

interface StatsData {
  totalDatabases: number;
  totalTables: number;
  totalConnections: number;
  serverUptime: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch("/api/databases");
      if (!res.ok) throw new Error("Failed to fetch databases");

      const data: DatabaseInfo[] = await res.json();
      setDatabases(data);

      const totalTables = data.reduce((sum, db) => sum + db.tableCount, 0);
      const totalConnections = data.reduce(
        (sum, db) => sum + db.activeConnections,
        0
      );

      setStats({
        totalDatabases: data.length,
        totalTables,
        totalConnections,
        serverUptime: "Ativo",
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const statCards = [
    {
      title: "Total de Bancos",
      value: stats?.totalDatabases ?? 0,
      icon: Database,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total de Tabelas",
      value: stats?.totalTables ?? 0,
      icon: TableProperties,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Conexoes Ativas",
      value: stats?.totalConnections ?? 0,
      icon: Activity,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Status do Servidor",
      value: stats?.serverUptime ?? "---",
      icon: Clock,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  const getDbTypeLabel = (type: DbType) => DB_TYPE_LABELS[type] || type;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Visao geral dos seus bancos de dados
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="flex items-center gap-4 p-6">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${stat.bgColor}`}
                  >
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {stat.title}
                    </p>
                    {isLoading ? (
                      <Skeleton className="mt-1 h-7 w-16" />
                    ) : (
                      <p className="text-2xl font-bold">{stat.value}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Database Cards */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Bancos de Dados</h2>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : databases.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Database className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Nenhum banco de dados configurado
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure as variaveis de ambiente DB_1_NAME, DB_1_HOST, etc.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {databases.map((db) => (
                <Card
                  key={db.name}
                  className="cursor-pointer transition-colors hover:border-primary/50"
                  onClick={() => router.push(`/databases/${db.name}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Database className="h-4 w-4 text-primary" />
                        {db.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            db.status === "online"
                              ? "bg-emerald-500"
                              : "bg-red-500"
                          }`}
                        />
                        <Badge
                          variant={
                            db.status === "online" ? "secondary" : "destructive"
                          }
                          className="text-xs"
                        >
                          {db.status === "online" ? "Online" : "Offline"}
                        </Badge>
                      </div>
                    </div>
                    {/* DB Type Badge */}
                    <Badge
                      variant="outline"
                      className={`w-fit text-[10px] font-medium ${DB_TYPE_COLORS[db.type] || DB_TYPE_COLORS.postgresql}`}
                    >
                      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${DB_TYPE_DOT[db.type] || DB_TYPE_DOT.postgresql}`} />
                      {getDbTypeLabel(db.type)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tamanho</span>
                      <span className="font-medium">{db.size}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tabelas</span>
                      <span className="font-medium">{db.tableCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Conexoes</span>
                      <span className="font-medium">
                        {db.activeConnections}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Host</span>
                      <span className="font-mono text-xs">
                        {db.host}:{db.port}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
