"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Loader2,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface BackupHistoryItem {
  id: string;
  date: string;
  size: string;
  status: "completed" | "failed" | "in_progress";
  downloadUrl?: string;
}

interface BackupManagerProps {
  database: string;
}

export function BackupManager({ database }: BackupManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [backupResult, setBackupResult] = useState<{
    success: boolean;
    downloadUrl?: string;
    message?: string;
  } | null>(null);
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/logs?operation=backup&database=${encodeURIComponent(database)}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.logs || []);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setIsLoadingHistory(false);
    }
  }, [database]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setBackupResult(null);

    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database }),
      });

      const data = await res.json();

      if (res.ok) {
        setBackupResult({
          success: true,
          downloadUrl: data.downloadUrl,
          message: "Backup criado com sucesso!",
        });
        // Refresh history
        fetchHistory();
      } else {
        setBackupResult({
          success: false,
          message: data.error || "Erro ao criar backup",
        });
      }
    } catch {
      setBackupResult({
        success: false,
        message: "Erro de conexao ao criar backup",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusIcon = (status: BackupHistoryItem["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardDrive className="h-5 w-5" />
              Backups
            </CardTitle>
            <CardDescription>
              Gerenciar backups do banco{" "}
              <span className="font-medium text-foreground">{database}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              title="Atualizar historico"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  isLoadingHistory && "animate-spin"
                )}
              />
            </Button>
            <Button
              size="sm"
              onClick={handleCreateBackup}
              disabled={isCreating}
              className="gap-1.5"
            >
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <HardDrive className="h-3.5 w-3.5" />
              )}
              Criar Backup
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Backup result notification */}
        {backupResult && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-md border p-3",
              backupResult.success
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            )}
          >
            {backupResult.success ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 text-red-500" />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  backupResult.success
                    ? "text-emerald-500"
                    : "text-red-500"
                )}
              >
                {backupResult.message}
              </p>
            </div>
            {backupResult.downloadUrl && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={backupResult.downloadUrl} download>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Backup history */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">
            Historico de backups
          </h4>

          {isLoadingHistory ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-border p-3"
                >
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Clock className="h-8 w-8" />
              <span className="text-sm">Nenhum backup encontrado</span>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/30"
                >
                  {getStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {formatDate(item.date)}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.size}</p>
                  </div>
                  {item.status === "completed" && item.downloadUrl && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                    >
                      <a href={item.downloadUrl} download>
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                  )}
                  {item.status === "failed" && (
                    <span className="text-xs text-red-500">Falhou</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
