"use client";

import React, { useState, useMemo } from "react";
import { BookOpen, Search, Code2, Copy, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  categories,
  type SqlCommand,
  type DbEngine,
  type CommandCategory,
} from "./commands-data";

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function engineBadge(engine: DbEngine) {
  switch (engine) {
    case "pg":
      return (
        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/15 text-blue-400 text-[10px]">
          PostgreSQL
        </Badge>
      );
    case "mysql":
      return (
        <Badge variant="outline" className="border-orange-500/30 bg-orange-500/15 text-orange-400 text-[10px]">
          MySQL / MariaDB
        </Badge>
      );
    case "both":
      return (
        <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/15 text-zinc-400 text-[10px]">
          Todos
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

type DbFilter = "all" | "pg" | "mysql";

function filterCommands(cmds: SqlCommand[], search: string, dbFilter: DbFilter): SqlCommand[] {
  return cmds.filter((cmd) => {
    if (dbFilter === "pg" && cmd.engine === "mysql") return false;
    if (dbFilter === "mysql" && cmd.engine === "pg") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.syntax.toLowerCase().includes(q) ||
      (cmd.pgExample && cmd.pgExample.toLowerCase().includes(q)) ||
      (cmd.mysqlExample && cmd.mysqlExample.toLowerCase().includes(q)) ||
      (cmd.commonExample && cmd.commonExample.toLowerCase().includes(q))
    );
  });
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover/code:opacity-100"
      onClick={handleCopy}
      title="Copiar"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Code Block
// ---------------------------------------------------------------------------

function CodeBlock({ code, label, dotColor }: { code: string; label?: string; dotColor?: string }) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center gap-1.5">
          {dotColor && <span className={`h-2 w-2 rounded-full ${dotColor}`} />}
          <p className={`text-xs font-medium uppercase tracking-wider ${
            dotColor === "bg-blue-500" ? "text-blue-400" :
            dotColor === "bg-orange-500" ? "text-orange-400" :
            "text-muted-foreground"
          }`}>
            {label}
          </p>
        </div>
      )}
      <div className="group/code relative">
        <pre className={`overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-300 ${
          dotColor === "bg-blue-500" ? "border border-blue-500/10" :
          dotColor === "bg-orange-500" ? "border border-orange-500/10" :
          ""
        }`}>
          <code>{code}</code>
        </pre>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command Card
// ---------------------------------------------------------------------------

function CommandCard({ cmd, dbFilter }: { cmd: SqlCommand; dbFilter: DbFilter }) {
  const showPg = dbFilter !== "mysql";
  const showMysql = dbFilter !== "pg";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Code2 className="h-4 w-4 shrink-0 text-primary" />
            {cmd.name}
          </CardTitle>
          {engineBadge(cmd.engine)}
        </div>
        <p className="text-sm text-muted-foreground">{cmd.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <CodeBlock code={cmd.syntax} label="Sintaxe" />

        {cmd.commonExample && (
          <CodeBlock code={cmd.commonExample} label="Exemplo" />
        )}

        {cmd.pgExample && showPg && (
          <CodeBlock code={cmd.pgExample} label="PostgreSQL" dotColor="bg-blue-500" />
        )}

        {cmd.mysqlExample && showMysql && (
          <CodeBlock code={cmd.mysqlExample} label="MySQL / MariaDB" dotColor="bg-orange-500" />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommandsPage() {
  const [search, setSearch] = useState("");
  const [dbFilter, setDbFilter] = useState<DbFilter>("all");
  const [activeTab, setActiveTab] = useState("ddl");

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const cat of categories) {
      result[cat.id] = filterCommands(cat.commands, search, dbFilter).length;
    }
    return result;
  }, [search, dbFilter]);

  const totalCommands = categories.reduce((sum, cat) => sum + cat.commands.length, 0);
  const filteredTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Referencia de Comandos SQL
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalCommands} comandos &middot; PostgreSQL, MySQL &amp; MariaDB
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar comandos, sintaxe ou palavras-chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setDbFilter("all")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                dbFilter === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setDbFilter("pg")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                dbFilter === "pg"
                  ? "border-blue-500 bg-blue-500/15 text-blue-400"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
              PostgreSQL
            </button>
            <button
              onClick={() => setDbFilter("mysql")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                dbFilter === "mysql"
                  ? "border-orange-500 bg-orange-500/15 text-orange-400"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
              MySQL
            </button>
          </div>
        </div>

        {/* Results count */}
        {(search || dbFilter !== "all") && (
          <p className="text-sm text-muted-foreground">
            Exibindo{" "}
            <span className="font-medium text-foreground">{filteredTotal}</span>{" "}
            de {totalCommands} comandos
          </p>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full flex-wrap gap-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{cat.label}</span>
                  <span className="sm:hidden">{cat.shortLabel}</span>
                  {counts[cat.id] !== undefined && (
                    <Badge variant="secondary" className="ml-0.5 h-5 min-w-[20px] px-1 text-[10px]">
                      {counts[cat.id]}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map((cat) => {
            const filtered = filterCommands(cat.commands, search, dbFilter);
            return (
              <TabsContent key={cat.id} value={cat.id} className="mt-4">
                {filtered.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                      <Search className="h-10 w-10 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Nenhum comando encontrado para os filtros selecionados.
                      </p>
                      <button
                        onClick={() => { setSearch(""); setDbFilter("all"); }}
                        className="text-sm text-primary hover:underline"
                      >
                        Limpar filtros
                      </button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {filtered.map((cmd) => (
                      <CommandCard key={cmd.name} cmd={cmd} dbFilter={dbFilter} />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AppShell>
  );
}
