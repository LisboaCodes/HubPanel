"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  RefreshCw,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface LogEntry {
  id: number;
  timestamp: string;
  user_email: string;
  database_name: string;
  operation: string;
  details: string | null;
  sql_query: string | null;
}

interface DatabaseInfo {
  name: string;
  status: string;
}

const OPERATION_TYPES = [
  { value: "", label: "Todas" },
  { value: "QUERY", label: "Query" },
  { value: "INSERT", label: "Insert" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "BACKUP", label: "Backup" },
  { value: "CREATE_USER", label: "Criar Usuario" },
  { value: "DROP_USER", label: "Remover Usuario" },
];

const PAGE_SIZE = 50;

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [filterDb, setFilterDb] = useState("");
  const [filterOperation, setFilterOperation] = useState("");

  // Fetch databases for filter dropdown
  useEffect(() => {
    async function fetchDbs() {
      try {
        const res = await fetch("/api/databases");
        if (res.ok) {
          const data: DatabaseInfo[] = await res.json();
          setDatabases(data);
        }
      } catch {
        // Ignore
      }
    }
    fetchDbs();
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });

      if (filterDb) params.set("database", filterDb);
      if (filterOperation) params.set("operation", filterOperation);

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const logsArray = Array.isArray(data) ? data : [];
        setLogs(logsArray);
        setHasMore(logsArray.length >= PAGE_SIZE);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, filterDb, filterOperation]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterDb, filterOperation]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getOperationBadge = (operation: string) => {
    switch (operation.toUpperCase()) {
      case "QUERY":
        return "secondary";
      case "INSERT":
        return "default";
      case "UPDATE":
        return "default";
      case "DELETE":
        return "destructive";
      case "BACKUP":
        return "outline";
      case "CREATE_USER":
        return "default";
      case "DROP_USER":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
            <p className="text-sm text-muted-foreground">
              Historico de atividades e operacoes
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
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

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filtros:</span>
            </div>

            <Select value={filterDb} onValueChange={setFilterDb}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os bancos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os bancos</SelectItem>
                {databases.map((db) => (
                  <SelectItem key={db.name} value={db.name}>
                    {db.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterOperation}
              onValueChange={setFilterOperation}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas operacoes" />
              </SelectTrigger>
              <SelectContent>
                {OPERATION_TYPES.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterDb || filterOperation) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDb("");
                  setFilterOperation("");
                }}
                className="text-xs"
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Registros de Atividade
            </CardTitle>
            <CardDescription>
              Logs de operacoes executadas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <FileText className="h-12 w-12" />
                <p className="text-sm">Nenhum registro encontrado</p>
                <p className="text-xs">
                  Os logs sao gerados automaticamente ao executar operacoes
                </p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Operacao</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(log.timestamp)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user_email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {log.database_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getOperationBadge(log.operation) as "default" | "secondary" | "outline" | "destructive"}
                            className="text-xs"
                          >
                            {log.operation}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="max-w-[400px] truncate font-mono text-xs text-muted-foreground"
                          title={log.sql_query || log.details || ""}
                        >
                          {log.sql_query || log.details || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!isLoading && logs.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Pagina {page + 1}
              {logs.length > 0 && ` - ${logs.length} registros`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
