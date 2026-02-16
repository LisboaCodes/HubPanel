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

interface DatabaseInfo {
  name: string;
  host: string;
  port: number;
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
              Gerencie seus bancos de dados PostgreSQL
            </p>
          </div>
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
                  <CardDescription className="font-mono text-xs">
                    {db.host}:{db.port}
                  </CardDescription>
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
    </AppShell>
  );
}
