"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  HardDrive,
  Download,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

interface BackupLogEntry {
  id: number;
  timestamp: string;
  user_email: string;
  database_name: string;
  operation: string;
  details: string;
  sql_query: string;
}

export default function BackupPage() {
  const params = useParams();
  const dbName = params.db as string;

  const [isCreating, setIsCreating] = useState(false);
  const [backupLogs, setBackupLogs] = useState<BackupLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const fetchBackupLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(
        `/api/logs?operation=BACKUP&database=${encodeURIComponent(dbName)}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setBackupLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoadingLogs(false);
    }
  }, [dbName]);

  useEffect(() => {
    fetchBackupLogs();
  }, [fetchBackupLogs]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database: dbName }),
      });

      if (res.ok) {
        // The response is an SQL file -- trigger download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${dbName}_backup_${Date.now()}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Backup criado",
          description: "O arquivo de backup foi baixado com sucesso.",
        });
        fetchBackupLogs();
      } else {
        const data = await res.json();
        toast({
          title: "Erro ao criar backup",
          description: data.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao ao criar backup",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

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

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Backup</h1>
            <p className="text-sm text-muted-foreground">
              Banco:{" "}
              <span className="font-medium text-foreground">
                {decodeURIComponent(dbName)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBackupLogs}
              disabled={isLoadingLogs}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingLogs ? "animate-spin" : ""}`}
              />
              Atualizar
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
                <Download className="h-3.5 w-3.5" />
              )}
              Criar Backup
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <HardDrive className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">Backup SQL</p>
              <p className="text-sm text-muted-foreground">
                Gera um dump SQL completo com todas as tabelas, estrutura e
                dados do banco de dados. O arquivo sera baixado automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Backup History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Historico de Backups
            </CardTitle>
            <CardDescription>
              Ultimas operacoes de backup registradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-md border border-border p-3"
                  >
                    <div className="h-5 w-5 animate-pulse rounded bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : backupLogs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <FileText className="h-10 w-10" />
                <p className="text-sm">Nenhum backup encontrado</p>
                <p className="text-xs">
                  Clique em &quot;Criar Backup&quot; para gerar seu primeiro backup
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {backupLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/30"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        Backup - {formatDate(log.timestamp)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Por: {log.user_email}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Concluido
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
