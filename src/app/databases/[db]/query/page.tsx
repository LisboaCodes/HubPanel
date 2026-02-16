"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Clock,
  Rows3,
  AlertCircle,
  Trash2,
  History,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { SqlEditor } from "@/components/sql-editor";

interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
  fields: { name: string; dataTypeID: number }[];
  duration: number;
}

interface QueryHistoryItem {
  id: string;
  sql: string;
  database: string;
  timestamp: string;
  rowCount: number;
  duration: number;
  isError: boolean;
}

export default function QueryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const dbName = params.db as string;

  const [sql, setSql] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Pre-fill SQL from URL query params
  useEffect(() => {
    const tableName = searchParams.get("table");
    if (tableName) {
      setSql(`SELECT * FROM "${tableName}" LIMIT 100;`);
    }
  }, [searchParams]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`hubpanel_query_history_${dbName}`);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, [dbName]);

  const saveHistory = useCallback(
    (item: QueryHistoryItem) => {
      setHistory((prev) => {
        const newHistory = [item, ...prev].slice(0, 50); // Keep last 50 queries
        try {
          localStorage.setItem(
            `hubpanel_query_history_${dbName}`,
            JSON.stringify(newHistory)
          );
        } catch {
          // Ignore storage errors
        }
        return newHistory;
      });
    },
    [dbName]
  );

  const handleRun = useCallback(async () => {
    if (!sql.trim() || isRunning) return;

    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database: dbName, sql: sql.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        saveHistory({
          id: Date.now().toString(),
          sql: sql.trim(),
          database: dbName,
          timestamp: new Date().toISOString(),
          rowCount: data.rowCount ?? data.rows?.length ?? 0,
          duration: data.duration,
          isError: false,
        });
      } else {
        setError(data.error || "Erro ao executar consulta");
        saveHistory({
          id: Date.now().toString(),
          sql: sql.trim(),
          database: dbName,
          timestamp: new Date().toISOString(),
          rowCount: 0,
          duration: data.duration ?? 0,
          isError: true,
        });
      }
    } catch {
      setError("Erro de conexao ao executar consulta");
    } finally {
      setIsRunning(false);
    }
  }, [sql, dbName, isRunning, saveHistory]);

  const handleLoadFromHistory = (item: QueryHistoryItem) => {
    setSql(item.sql);
    setShowHistory(false);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(`hubpanel_query_history_${dbName}`);
    } catch {
      // Ignore
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Consulta SQL
            </h1>
            <p className="text-sm text-muted-foreground">
              Banco:{" "}
              <span className="font-medium text-foreground">
                {decodeURIComponent(dbName)}
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1.5"
          >
            <History className="h-3.5 w-3.5" />
            Historico
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main Column */}
          <div className="space-y-4">
            {/* SQL Editor */}
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={handleRun}
              database={dbName}
              height={400}
              isRunning={isRunning}
            />

            {/* Results */}
            {error && (
              <Card className="border-destructive/50">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      Erro na consulta
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {error}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {result && (
              <div className="space-y-3">
                {/* Stats */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Rows3 className="h-3.5 w-3.5" />
                    <span>
                      {result.rows?.length ?? 0} registro(s) retornado(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{result.duration}ms</span>
                  </div>
                </div>

                {/* Results Table */}
                {result.fields && result.fields.length > 0 && result.rows && (
                  <Card>
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {result.fields.map((field) => (
                              <TableHead
                                key={field.name}
                                className="whitespace-nowrap"
                              >
                                {field.name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.rows.map((row, idx) => (
                            <TableRow key={idx}>
                              {result.fields.map((field) => (
                                <TableCell
                                  key={`${idx}-${field.name}`}
                                  className="max-w-[300px] truncate font-mono text-xs"
                                  title={String(row[field.name] ?? "NULL")}
                                >
                                  {row[field.name] === null ||
                                  row[field.name] === undefined ? (
                                    <span className="italic text-muted-foreground">
                                      NULL
                                    </span>
                                  ) : typeof row[field.name] === "object" ? (
                                    JSON.stringify(row[field.name])
                                  ) : (
                                    String(row[field.name])
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}

                {/* Row count for non-SELECT queries */}
                {result.rowCount !== null &&
                  (!result.fields || result.fields.length === 0) && (
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">
                          Consulta executada com sucesso.{" "}
                          <span className="font-medium text-foreground">
                            {result.rowCount}
                          </span>{" "}
                          linha(s) afetada(s).
                        </p>
                      </CardContent>
                    </Card>
                  )}
              </div>
            )}
          </div>

          {/* History Sidebar (visible on large screens or toggled) */}
          <div
            className={`space-y-3 ${showHistory ? "block" : "hidden lg:block"}`}
          >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Historico</CardTitle>
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearHistory}
                      className="h-7 gap-1 text-xs text-muted-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                      Limpar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="max-h-[600px] space-y-1 overflow-y-auto p-3 pt-0">
                {history.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Nenhuma consulta no historico
                  </p>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50"
                      onClick={() => handleLoadFromHistory(item)}
                    >
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs">
                          {item.sql}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(item.timestamp)}
                          </span>
                          {item.isError ? (
                            <Badge
                              variant="destructive"
                              className="h-4 text-[10px]"
                            >
                              Erro
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {item.rowCount} linhas - {item.duration}ms
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
