"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  RefreshCw,
  Loader2,
  Zap,
  HardDrive,
  Gauge,
  XCircle,
  Play,
  Pause,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";

interface Connection {
  pid: number;
  user: string;
  database: string;
  client_addr: string | null;
  application_name: string;
  state: string;
  query: string;
  backend_start: string;
  query_start: string;
  query_duration: string;
}

interface DatabaseSize {
  name: string;
  size: string;
  size_bytes: number;
}

interface MonitoringData {
  activeConnections: Connection[];
  connectionCount: number;
  databaseSizes: DatabaseSize[];
  cacheHitRatio: {
    heapRead: number;
    heapHit: number;
    ratio: number;
  };
  transactions: {
    total: number;
    commits: number;
    rollbacks: number;
    tps: number;
  };
  slowQueries: unknown[];
  tableBloat: unknown[];
}

interface DatabaseInfo {
  name: string;
  status: "online" | "offline";
}

export default function MonitoringPage() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch databases list
  useEffect(() => {
    async function fetchDatabases() {
      try {
        const res = await fetch("/api/databases");
        if (res.ok) {
          const data: DatabaseInfo[] = await res.json();
          setDatabases(data);
          if (data.length > 0 && !selectedDb) {
            setSelectedDb(data[0].name);
          }
        }
      } catch (error) {
        console.error("Error fetching databases:", error);
      }
    }
    fetchDatabases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMonitoring = useCallback(
    async (showLoading = false) => {
      if (!selectedDb) return;
      if (showLoading) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const res = await fetch(
          `/api/monitoring?db=${encodeURIComponent(selectedDb)}`
        );
        if (res.ok) {
          const data: MonitoringData = await res.json();
          setMonitoringData(data);
        }
      } catch (error) {
        console.error("Error fetching monitoring data:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDb]
  );

  useEffect(() => {
    if (selectedDb) {
      fetchMonitoring(true);
    }
  }, [selectedDb, fetchMonitoring]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && selectedDb) {
      intervalRef.current = setInterval(() => {
        fetchMonitoring(false);
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, selectedDb, fetchMonitoring]);

  const handleKillConnection = async (pid: number) => {
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: selectedDb,
          sql: `SELECT pg_terminate_backend(${pid})`,
        }),
      });

      if (res.ok) {
        toast({
          title: "Conexao encerrada",
          description: `Processo ${pid} foi encerrado`,
        });
        fetchMonitoring(false);
      } else {
        const data = await res.json();
        toast({
          title: "Erro",
          description: data.error || "Erro ao encerrar conexao",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao",
        variant: "destructive",
      });
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "active":
        return "bg-emerald-500";
      case "idle":
        return "bg-yellow-500";
      case "idle in transaction":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case "active":
        return "default";
      case "idle":
        return "secondary";
      case "idle in transaction":
        return "outline";
      default:
        return "secondary" as const;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Monitoramento
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitore conexoes, performance e recursos do PostgreSQL
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Database selector */}
            <Select value={selectedDb} onValueChange={setSelectedDb}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecionar banco" />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db.name} value={db.name}>
                    {db.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Auto-refresh toggle */}
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-1.5"
              title={autoRefresh ? "Parar auto-refresh" : "Auto-refresh (5s)"}
            >
              {autoRefresh ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Auto
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchMonitoring(false)}
              disabled={isRefreshing || !selectedDb}
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
        </div>

        {!selectedDb ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Activity className="h-12 w-12" />
              <p>Selecione um banco de dados para monitorar</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : monitoringData ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conexoes</p>
                    <p className="text-2xl font-bold">
                      {monitoringData.connectionCount}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Gauge className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Cache Hit Ratio
                    </p>
                    <p className="text-2xl font-bold">
                      {monitoringData.cacheHitRatio.ratio}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                    <Zap className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">TPS</p>
                    <p className="text-2xl font-bold">
                      {monitoringData.transactions.tps}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                    <HardDrive className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bancos</p>
                    <p className="text-2xl font-bold">
                      {monitoringData.databaseSizes.length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Connections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Conexoes Ativas
                </CardTitle>
                <CardDescription>
                  Processos ativos no PostgreSQL (pg_stat_activity)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {monitoringData.activeConnections.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <Activity className="h-8 w-8" />
                    <p className="text-sm">Nenhuma conexao ativa</p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PID</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Query</TableHead>
                          <TableHead>Duracao</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monitoringData.activeConnections.map((conn) => (
                          <TableRow key={conn.pid}>
                            <TableCell className="font-mono text-sm">
                              {conn.pid}
                            </TableCell>
                            <TableCell className="text-sm">
                              {conn.database}
                            </TableCell>
                            <TableCell className="text-sm">
                              {conn.user}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getStateBadge(conn.state) as "default" | "secondary" | "outline" | "destructive"}
                                className="gap-1 text-xs"
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${getStateColor(conn.state)}`}
                                />
                                {conn.state || "unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="max-w-[300px] truncate font-mono text-xs"
                              title={conn.query}
                            >
                              {conn.query || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {conn.query_duration
                                ? String(conn.query_duration).split(".")[0]
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleKillConnection(conn.pid)}
                                title="Encerrar conexao"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Database Sizes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-4 w-4" />
                  Tamanhos dos Bancos
                </CardTitle>
                <CardDescription>
                  Comparacao de tamanho entre todos os bancos de dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {monitoringData.databaseSizes.map((db) => {
                    const maxSize = Math.max(
                      ...monitoringData.databaseSizes.map((d) =>
                        Number(d.size_bytes)
                      )
                    );
                    const percentage =
                      maxSize > 0
                        ? (Number(db.size_bytes) / maxSize) * 100
                        : 0;

                    return (
                      <div key={db.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{db.name}</span>
                          <span className="text-muted-foreground">
                            {db.size}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Cache Hit Ratio Detail */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="h-4 w-4" />
                  Performance do Cache
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-emerald-500">
                      {monitoringData.cacheHitRatio.ratio}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Hit Ratio
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {monitoringData.cacheHitRatio.heapHit.toLocaleString(
                        "pt-BR"
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Heap Hits
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {monitoringData.cacheHitRatio.heapRead.toLocaleString(
                        "pt-BR"
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Heap Reads (disco)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Erro ao carregar dados de monitoramento
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
