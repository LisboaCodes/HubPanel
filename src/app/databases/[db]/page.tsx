"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Database,
  TableProperties,
  Activity,
  HardDrive,
  RefreshCw,
  Loader2,
  Terminal,
  Eye,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
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
import { Skeleton } from "@/components/ui/skeleton";

interface TableInfo {
  name: string;
  size: string;
  size_bytes: number;
  row_estimate: number;
}

interface DbStats {
  name: string;
  host: string;
  port: number;
  size: string;
  tableCount: number;
  activeConnections: number;
  status: "online" | "offline";
}

export default function DatabaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dbName = params.db as string;

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [dbInfo, setDbInfo] = useState<DbStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tablesRes, dbRes] = await Promise.all([
        fetch(`/api/tables?db=${encodeURIComponent(dbName)}`),
        fetch("/api/databases"),
      ]);

      if (tablesRes.ok) {
        const tablesData = await tablesRes.json();
        setTables(tablesData);
      }

      if (dbRes.ok) {
        const allDbs: DbStats[] = await dbRes.json();
        const currentDb = allDbs.find((d) => d.name === dbName);
        if (currentDb) setDbInfo(currentDb);
      }
    } catch (error) {
      console.error("Error fetching database details:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {decodeURIComponent(dbName)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Detalhes e tabelas do banco de dados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/databases/${dbName}/query`)}
              className="gap-1.5"
            >
              <Terminal className="h-3.5 w-3.5" />
              Consulta SQL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
              className="gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Atualizar
            </Button>
          </div>
        </div>

        {/* Database Info Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <HardDrive className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tamanho</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-16" />
                ) : (
                  <p className="text-xl font-bold">
                    {dbInfo?.size ?? "N/A"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <TableProperties className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tabelas</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className="text-xl font-bold">{tables.length}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conexoes</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className="text-xl font-bold">
                    {dbInfo?.activeConnections ?? 0}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Database className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-16" />
                ) : (
                  <Badge
                    variant={
                      dbInfo?.status === "online" ? "secondary" : "destructive"
                    }
                    className="mt-1"
                  >
                    {dbInfo?.status === "online" ? "Online" : "Offline"}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Tabelas</h2>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tabela..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <Card>
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </Card>
          ) : filteredTables.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <TableProperties className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Nenhuma tabela encontrada para a busca"
                    : "Nenhuma tabela encontrada neste banco"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTables.map((table) => (
                    <TableRow
                      key={table.name}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/databases/${dbName}/tables/${table.name}`
                        )
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TableProperties className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{table.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(table.row_estimate).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {table.size}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/databases/${dbName}/tables/${table.name}`
                              );
                            }}
                            title="Ver dados"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/databases/${dbName}/query?table=${table.name}`
                              );
                            }}
                            title="Consulta SQL"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
