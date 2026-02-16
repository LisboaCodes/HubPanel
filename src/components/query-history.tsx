"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  Search,
  Clock,
  Timer,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: string;
  duration: number; // milliseconds
  rowsAffected?: number;
  status?: "success" | "error";
}

interface QueryHistoryProps {
  database: string;
  onSelectQuery: (sql: string) => void;
}

export function QueryHistory({ database, onSelectQuery }: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/logs?operation=query&database=${encodeURIComponent(database)}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.logs || []);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter((item) => item.sql.toLowerCase().includes(term));
  }, [history, searchTerm]);

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Agora";
      if (diffMins < 60) return `${diffMins}min atras`;
      if (diffHours < 24) return `${diffHours}h atras`;
      if (diffDays < 7) return `${diffDays}d atras`;

      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1) return "<1ms";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const truncateSQL = (sql: string, maxLength: number = 120) => {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) return normalized;
    return normalized.substring(0, maxLength) + "...";
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Historico de Queries</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={fetchHistory}
          disabled={isLoading}
          title="Atualizar"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
          />
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-border px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar queries..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Clock className="h-8 w-8" />
            <span className="text-sm">
              {searchTerm
                ? "Nenhuma query encontrada"
                : "Nenhum historico disponivel"}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectQuery(item.sql)}
                className="group flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-mono text-xs leading-relaxed text-foreground">
                    {truncateSQL(item.sql)}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(item.timestamp)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {formatDuration(item.duration)}
                    </span>
                    {item.rowsAffected !== undefined && (
                      <span>{item.rowsAffected} linhas</span>
                    )}
                    {item.status === "error" && (
                      <span className="text-red-500">Erro</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
