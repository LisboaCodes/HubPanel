"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Search,
  Terminal,
  HardDrive,
  Users,
  RefreshCw,
  Loader2,
  Plus,
  PlugZap,
  Upload,
  Trash2,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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

const DEFAULT_PORTS: Record<DbType, number> = {
  postgresql: 5432,
  mysql: 3306,
  mariadb: 3306,
  supabase: 5432,
};

interface DatabaseInfo {
  name: string;
  host: string;
  port: number;
  type: DbType;
  source: "env" | "stored";
  size: string;
  tableCount: number;
  activeConnections: number;
  status: "online" | "offline";
  error?: string;
}

export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Database dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [selectedHost, setSelectedHost] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{
    message: string;
    envVars?: Record<string, string>;
    note?: string;
  } | null>(null);

  // New Connection dialog
  const [showConnDialog, setShowConnDialog] = useState(false);
  const [connForm, setConnForm] = useState({
    name: "",
    host: "",
    port: "5432",
    username: "",
    password: "",
    database: "",
    db_type: "postgresql" as DbType,
  });
  const [connTesting, setConnTesting] = useState(false);
  const [connTestResult, setConnTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [connSaving, setConnSaving] = useState(false);
  const [connSaveResult, setConnSaveResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Import SQL dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importDb, setImportDb] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success?: boolean;
    statementsExecuted?: number;
    errors?: string[];
    error?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete connection
  const [deletingConn, setDeletingConn] = useState<string | null>(null);

  const fetchDatabases = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/databases");
      if (!res.ok) throw new Error("Failed to fetch databases");
      const data: DatabaseInfo[] = await res.json();
      setDatabases(data);
    } catch (error) {
      console.error("Error fetching databases:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  const filteredDatabases = databases.filter((db) =>
    db.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Create Database ---
  const handleCreateDatabase = async () => {
    if (!newDbName || !selectedHost) return;
    setCreating(true);
    setCreateResult(null);

    try {
      const res = await fetch("/api/databases/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostDb: selectedHost, newDbName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create database");

      setCreateResult({
        message: data.message,
        envVars: data.envVars,
        note: data.note,
      });
      setNewDbName("");
      fetchDatabases();
    } catch (err) {
      setCreateResult({
        message: err instanceof Error ? err.message : "Erro ao criar banco",
      });
    } finally {
      setCreating(false);
    }
  };

  // --- Test Connection ---
  const handleTestConnection = async () => {
    setConnTesting(true);
    setConnTestResult(null);

    try {
      const res = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: connForm.host,
          port: parseInt(connForm.port, 10),
          username: connForm.username,
          password: connForm.password,
          database: connForm.database,
          db_type: connForm.db_type,
        }),
      });

      const data = await res.json();
      setConnTestResult({
        ok: data.ok,
        latencyMs: data.latencyMs,
        error: data.error,
      });
    } catch (err) {
      setConnTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Erro de rede",
      });
    } finally {
      setConnTesting(false);
    }
  };

  // --- Save Connection ---
  const handleSaveConnection = async () => {
    setConnSaving(true);
    setConnSaveResult(null);

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: connForm.name,
          host: connForm.host,
          port: parseInt(connForm.port, 10),
          username: connForm.username,
          password: connForm.password,
          database: connForm.database,
          db_type: connForm.db_type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setConnSaveResult({
          ok: false,
          message: data.error || "Erro ao salvar conexao",
        });
        return;
      }

      setConnSaveResult({
        ok: true,
        message: `Conexao "${connForm.name}" salva com sucesso! (${data.testLatencyMs}ms)`,
      });

      // Reset form
      setConnForm({
        name: "",
        host: "",
        port: "5432",
        username: "",
        password: "",
        database: "",
        db_type: "postgresql",
      });
      setConnTestResult(null);

      // Refresh database list
      fetchDatabases();
    } catch (err) {
      setConnSaveResult({
        ok: false,
        message: err instanceof Error ? err.message : "Erro de rede",
      });
    } finally {
      setConnSaving(false);
    }
  };

  // --- Delete Connection ---
  const handleDeleteConnection = async (name: string) => {
    setDeletingConn(name);
    try {
      const res = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Error deleting connection:", data.error);
      }

      fetchDatabases();
    } catch (err) {
      console.error("Error deleting connection:", err);
    } finally {
      setDeletingConn(null);
    }
  };

  // --- Import SQL ---
  const handleImportSQL = async () => {
    if (!importDb || !importFile) return;
    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("database", importDb);
      formData.append("file", importFile);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setImportResult({ error: data.error || "Erro ao importar" });
        return;
      }

      setImportResult({
        success: data.success,
        statementsExecuted: data.statementsExecuted,
        errors: data.errors,
      });

      // Refresh
      fetchDatabases();
    } catch (err) {
      setImportResult({
        error: err instanceof Error ? err.message : "Erro de rede",
      });
    } finally {
      setImporting(false);
    }
  };

  const getDbTypeLabel = (type: DbType) => DB_TYPE_LABELS[type] || type;

  const connFormValid =
    connForm.name &&
    connForm.host &&
    connForm.port &&
    connForm.username &&
    connForm.password &&
    connForm.database;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bancos de Dados
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie seus bancos de dados
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setShowConnDialog(true);
                setConnTestResult(null);
                setConnSaveResult(null);
              }}
              className="gap-1.5"
            >
              <PlugZap className="h-3.5 w-3.5" />
              Nova Conexao
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCreateDialog(true);
                setCreateResult(null);
                setNewDbName("");
                if (databases.length > 0 && !selectedHost) {
                  setSelectedHost(databases[0].name);
                }
              }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Banco
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowImportDialog(true);
                setImportResult(null);
                setImportFile(null);
                if (databases.length > 0 && !importDb) {
                  setImportDb(databases[0].name);
                }
              }}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar SQL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDatabases}
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar banco de dados..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Database Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-9 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : filteredDatabases.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <Database className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Nenhum banco encontrado para a busca"
                  : "Nenhum banco de dados configurado"}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConnDialog(true)}
                  className="gap-1.5"
                >
                  <PlugZap className="h-3.5 w-3.5" />
                  Adicionar Conexao
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDatabases.map((db) => (
              <Card
                key={db.name}
                className="flex flex-col transition-colors hover:border-primary/50"
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
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium ${DB_TYPE_COLORS[db.type] || DB_TYPE_COLORS.postgresql}`}
                    >
                      <span
                        className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${DB_TYPE_DOT[db.type] || DB_TYPE_DOT.postgresql}`}
                      />
                      {getDbTypeLabel(db.type)}
                    </Badge>
                    {db.source === "stored" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium bg-violet-500/15 text-violet-400 border-violet-500/30"
                      >
                        Salvo
                      </Badge>
                    )}
                    <CardDescription className="font-mono text-xs">
                      {db.host}:{db.port}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tamanho</span>
                    <span className="font-medium">{db.size}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tabelas</span>
                    <span className="font-medium">{db.tableCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Conexoes ativas
                    </span>
                    <span className="font-medium">{db.activeConnections}</span>
                  </div>
                  {db.error && (
                    <p className="text-xs text-destructive">{db.error}</p>
                  )}
                </CardContent>

                <CardFooter className="gap-2 border-t border-border pt-4">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => router.push(`/databases/${db.name}`)}
                  >
                    <Database className="h-3.5 w-3.5" />
                    Abrir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => router.push(`/databases/${db.name}/query`)}
                    title="Consulta SQL"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => router.push(`/databases/${db.name}/backup`)}
                    title="Backup"
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => router.push(`/databases/${db.name}/users`)}
                    title="Usuarios"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                  {db.source === "stored" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Remover conexao "${db.name}"? O banco de dados nao sera apagado, apenas a conexao sera removida do HubPanel.`)) {
                          handleDeleteConnection(db.name);
                        }
                      }}
                      disabled={deletingConn === db.name}
                      title="Remover Conexao"
                    >
                      {deletingConn === db.name ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ==================== NEW CONNECTION DIALOG ==================== */}
      <Dialog open={showConnDialog} onOpenChange={setShowConnDialog}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5" />
              Nova Conexao
            </DialogTitle>
            <DialogDescription>
              Conecte a qualquer banco de dados. Preencha os dados de acesso,
              teste a conexao e salve.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* DB Type */}
            <div className="space-y-2">
              <Label>Tipo do Banco</Label>
              <Select
                value={connForm.db_type}
                onValueChange={(val: DbType) => {
                  setConnForm((prev) => ({
                    ...prev,
                    db_type: val,
                    port: String(DEFAULT_PORTS[val]),
                  }));
                  setConnTestResult(null);
                  setConnSaveResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgresql">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                      PostgreSQL
                    </span>
                  </SelectItem>
                  <SelectItem value="mysql">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                      MySQL
                    </span>
                  </SelectItem>
                  <SelectItem value="mariadb">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                      MariaDB
                    </span>
                  </SelectItem>
                  <SelectItem value="supabase">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      Supabase
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Nome da Conexao</Label>
              <Input
                placeholder="meu_banco_producao"
                value={connForm.name}
                onChange={(e) =>
                  setConnForm((prev) => ({
                    ...prev,
                    name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Identificador unico (letras, numeros e _)
              </p>
            </div>

            {/* Host + Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Host</Label>
                <Input
                  placeholder="localhost ou IP do servidor"
                  value={connForm.host}
                  onChange={(e) =>
                    setConnForm((prev) => ({ ...prev, host: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input
                  type="number"
                  placeholder={String(DEFAULT_PORTS[connForm.db_type])}
                  value={connForm.port}
                  onChange={(e) =>
                    setConnForm((prev) => ({ ...prev, port: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Username + Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Usuario</Label>
                <Input
                  placeholder="postgres"
                  value={connForm.username}
                  onChange={(e) =>
                    setConnForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input
                  type="password"
                  placeholder="********"
                  value={connForm.password}
                  onChange={(e) =>
                    setConnForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Database name */}
            <div className="space-y-2">
              <Label>Nome do Banco de Dados</Label>
              <Input
                placeholder="nome_do_banco"
                value={connForm.database}
                onChange={(e) =>
                  setConnForm((prev) => ({
                    ...prev,
                    database: e.target.value,
                  }))
                }
              />
            </div>

            {/* Test Connection Result */}
            {connTestResult && (
              <div
                className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                  connTestResult.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {connTestResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <div>
                  {connTestResult.ok ? (
                    <p>
                      Conexao bem-sucedida!{" "}
                      <span className="text-muted-foreground">
                        ({connTestResult.latencyMs}ms)
                      </span>
                    </p>
                  ) : (
                    <p>Falha na conexao: {connTestResult.error}</p>
                  )}
                </div>
              </div>
            )}

            {/* Save Result */}
            {connSaveResult && (
              <div
                className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                  connSaveResult.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {connSaveResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <p>{connSaveResult.message}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
            <Button
              variant="secondary"
              onClick={handleTestConnection}
              disabled={connTesting || !connFormValid}
              className="gap-1.5"
            >
              {connTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Testar Conexao
            </Button>
            <Button
              onClick={handleSaveConnection}
              disabled={connSaving || !connFormValid}
              className="gap-1.5"
            >
              {connSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Salvar Conexao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== CREATE DATABASE DIALOG ==================== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Banco de Dados</DialogTitle>
            <DialogDescription>
              Crie um novo banco no servidor de um dos seus bancos existentes. O
              novo banco sera criado na mesma instancia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Servidor (banco existente)</Label>
              <Select value={selectedHost} onValueChange={setSelectedHost}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o servidor" />
                </SelectTrigger>
                <SelectContent>
                  {databases
                    .filter((d) => d.status === "online")
                    .map((d) => (
                      <SelectItem key={d.name} value={d.name}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${DB_TYPE_DOT[d.type] || DB_TYPE_DOT.postgresql}`}
                          />
                          {d.name} ({getDbTypeLabel(d.type)})
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O novo banco sera criado neste servidor
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nome do novo banco</Label>
              <Input
                placeholder="meu_novo_banco"
                value={newDbName}
                onChange={(e) =>
                  setNewDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                }
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras, numeros e underscores
              </p>
            </div>

            {createResult && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  createResult.envVars
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                <p className="font-medium">{createResult.message}</p>
                {createResult.envVars && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium">
                      Variaveis de ambiente para adicionar no Coolify:
                    </p>
                    <pre className="mt-1 rounded bg-black/30 p-2 text-[11px] leading-relaxed">
                      {Object.entries(createResult.envVars)
                        .map(([k, v]) => `${k}=${v}`)
                        .join("\n")}
                    </pre>
                    {createResult.note && (
                      <p className="text-[11px] text-muted-foreground">
                        {createResult.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
            <Button
              onClick={handleCreateDatabase}
              disabled={creating || !newDbName || !selectedHost}
            >
              {creating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Criar Banco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== IMPORT SQL DIALOG ==================== */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar SQL
            </DialogTitle>
            <DialogDescription>
              Importe um arquivo .sql para um banco de dados. O arquivo sera
              executado sequencialmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Banco de Dados de Destino</Label>
              <Select value={importDb} onValueChange={setImportDb}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {databases
                    .filter((d) => d.status === "online")
                    .map((d) => (
                      <SelectItem key={d.name} value={d.name}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${DB_TYPE_DOT[d.type] || DB_TYPE_DOT.postgresql}`}
                          />
                          {d.name} ({getDbTypeLabel(d.type)})
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivo SQL</Label>
              <div
                className="relative flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50 hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setImportFile(f);
                  }}
                />
                <div className="text-center">
                  {importFile ? (
                    <>
                      <Database className="mx-auto h-8 w-8 text-primary" />
                      <p className="mt-2 text-sm font-medium">
                        {importFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Clique para selecionar um arquivo .sql
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {importResult && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  importResult.error
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : importResult.errors && importResult.errors.length > 0
                      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {importResult.error ? (
                  <p>{importResult.error}</p>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {importResult.statementsExecuted} statements executados com
                      sucesso
                    </p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium">
                          {importResult.errors.length} erro(s):
                        </p>
                        <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs">
                          {importResult.errors.map((err, i) => (
                            <li key={i} className="text-destructive">
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
            <Button
              onClick={handleImportSQL}
              disabled={importing || !importDb || !importFile}
              className="gap-1.5"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
