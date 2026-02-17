"use client";

import React, { useState, useEffect, useCallback } from "react";
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

export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [selectedHost, setSelectedHost] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ message: string; envVars?: Record<string, string>; note?: string } | null>(null);

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

  const getDbTypeLabel = (type: DbType) => DB_TYPE_LABELS[type] || type;

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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
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
                      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${DB_TYPE_DOT[db.type] || DB_TYPE_DOT.postgresql}`} />
                      {getDbTypeLabel(db.type)}
                    </Badge>
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
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Database Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Banco de Dados</DialogTitle>
            <DialogDescription>
              Crie um novo banco no servidor de um dos seus bancos existentes.
              O novo banco sera criado na mesma instancia.
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
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${DB_TYPE_DOT[d.type] || DB_TYPE_DOT.postgresql}`} />
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
                onChange={(e) => setNewDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras, numeros e underscores
              </p>
            </div>

            {createResult && (
              <div className={`rounded-md border p-3 text-sm ${
                createResult.envVars
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}>
                <p className="font-medium">{createResult.message}</p>
                {createResult.envVars && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium">Variaveis de ambiente para adicionar no Coolify:</p>
                    <pre className="mt-1 rounded bg-black/30 p-2 text-[11px] leading-relaxed">
                      {Object.entries(createResult.envVars)
                        .map(([k, v]) => `${k}=${v}`)
                        .join("\n")}
                    </pre>
                    {createResult.note && (
                      <p className="text-[11px] text-muted-foreground">{createResult.note}</p>
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
    </AppShell>
  );
}
