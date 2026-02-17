"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  BookOpen,
  Search,
  Code2,
  Copy,
  Check,
  Sparkles,
  Send,
  Loader2,
  X,
  ExternalLink,
  Trash2,
} from "lucide-react";
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
// AI Markdown Renderer (simple)
// ---------------------------------------------------------------------------

function AiMarkdown({ content }: { content: string }) {
  // Split into segments: code blocks vs text
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {segments.map((segment, i) => {
        // Code block
        if (segment.startsWith("```")) {
          const match = segment.match(/```(\w*)\n?([\s\S]*?)```/);
          const code = match ? match[2].trim() : segment.replace(/```/g, "").trim();
          return (
            <div key={i} className="group/code relative">
              <pre className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-300">
                <code>{code}</code>
              </pre>
              <CopyButton text={code} />
            </div>
          );
        }

        // Regular text - process inline markdown
        if (!segment.trim()) return null;
        return (
          <div key={i} className="text-foreground">
            {segment.split("\n").map((line, li) => {
              if (!line.trim()) return <br key={li} />;

              // Headers
              if (line.startsWith("### ")) {
                return <h4 key={li} className="mt-3 mb-1 text-sm font-semibold text-foreground">{line.slice(4)}</h4>;
              }
              if (line.startsWith("## ")) {
                return <h3 key={li} className="mt-4 mb-1 text-base font-semibold text-foreground">{line.slice(3)}</h3>;
              }
              if (line.startsWith("# ")) {
                return <h2 key={li} className="mt-4 mb-2 text-lg font-bold text-foreground">{line.slice(2)}</h2>;
              }

              // Bold
              const processed = line.replace(
                /\*\*(.*?)\*\*/g,
                '<strong class="font-semibold text-foreground">$1</strong>'
              ).replace(
                /`([^`]+)`/g,
                '<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-purple-300">$1</code>'
              );

              // List items
              if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                return (
                  <div key={li} className="flex gap-2 pl-2 text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                    <span dangerouslySetInnerHTML={{ __html: processed.replace(/^[\s]*[-*]\s/, "") }} />
                  </div>
                );
              }

              // Numbered list
              const numMatch = line.trim().match(/^(\d+)\.\s/);
              if (numMatch) {
                return (
                  <div key={li} className="flex gap-2 pl-2 text-muted-foreground">
                    <span className="shrink-0 font-mono text-xs text-primary">{numMatch[1]}.</span>
                    <span dangerouslySetInnerHTML={{ __html: processed.replace(/^\s*\d+\.\s/, "") }} />
                  </div>
                );
              }

              return <p key={li} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: processed }} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Assistant
// ---------------------------------------------------------------------------

interface AiMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

function AiAssistant() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || loading) return;

    setQuestion("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao consultar IA");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
        },
      ]);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const suggestions = [
    "Como criar um indice parcial no PostgreSQL?",
    "Diferenca entre JOIN e LATERAL JOIN",
    "Como fazer paginacao eficiente com milhoes de registros?",
    "MySQL vs PostgreSQL: quando usar cada um?",
    "Como migrar dados de MySQL para PostgreSQL?",
    "Boas praticas de seguranca para bancos de dados",
  ];

  return (
    <Card className="border-purple-500/20 bg-gradient-to-b from-purple-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15">
              <Sparkles className="h-4 w-4 text-purple-400" />
            </div>
            Assistente SQL com IA
            <Badge variant="outline" className="border-purple-500/30 bg-purple-500/15 text-purple-400 text-[10px]">
              Perplexity
            </Badge>
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1 text-xs text-muted-foreground">
              <Trash2 className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Pergunte qualquer coisa sobre SQL, bancos de dados, performance ou migracoes.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Messages */}
        {messages.length > 0 && (
          <div className="max-h-[500px] space-y-4 overflow-y-auto rounded-md border border-border bg-background/50 p-4">
            {messages.map((msg, i) => (
              <div key={i} className={`${msg.role === "user" ? "flex justify-end" : ""}`}>
                {msg.role === "user" ? (
                  <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {msg.content}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-xs font-medium text-purple-400">Perplexity AI</span>
                    </div>
                    <AiMarkdown content={msg.content} />
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fontes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((url, ci) => {
                            let domain = "";
                            try { domain = new URL(url).hostname.replace("www.", ""); } catch { domain = url; }
                            return (
                              <a
                                key={ci}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                {domain}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                Pensando...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Suggestions (when no messages) */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setQuestion(s); }}
                className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ex: Como otimizar uma query com JOIN em milhoes de registros?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
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
              {totalCommands} comandos &middot; PostgreSQL, MySQL &amp; MariaDB &middot; IA integrada
            </p>
          </div>
        </div>

        {/* AI Assistant */}
        <AiAssistant />

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
