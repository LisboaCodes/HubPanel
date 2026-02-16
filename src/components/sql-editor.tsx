"use client";

import React, { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Play, Trash2, AlignLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-md border border-border bg-card" style={{ height: 300 }}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando editor...</span>
      </div>
    </div>
  ),
});

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  database?: string;
  height?: number;
  isRunning?: boolean;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  database,
  height = 300,
  isRunning = false,
}: SqlEditorProps) {
  const editorRef = useRef<unknown>(null);

  const handleEditorMount = useCallback(
    (editor: unknown, monaco: unknown) => {
      editorRef.current = editor;

      // Register Ctrl+Enter / Cmd+Enter shortcut
      const monacoInstance = monaco as {
        KeyMod: { CtrlCmd: number };
        KeyCode: { Enter: number };
      };
      const editorInstance = editor as {
        addCommand: (keybinding: number, handler: () => void) => void;
      };

      editorInstance.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
        () => {
          onRun();
        }
      );
    },
    [onRun]
  );

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? "");
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  const handleFormat = useCallback(() => {
    // Basic SQL formatting: uppercase keywords, clean whitespace
    const keywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "AND",
      "OR",
      "INSERT",
      "INTO",
      "VALUES",
      "UPDATE",
      "SET",
      "DELETE",
      "CREATE",
      "TABLE",
      "ALTER",
      "DROP",
      "INDEX",
      "JOIN",
      "LEFT",
      "RIGHT",
      "INNER",
      "OUTER",
      "ON",
      "GROUP",
      "BY",
      "ORDER",
      "HAVING",
      "LIMIT",
      "OFFSET",
      "AS",
      "IN",
      "NOT",
      "NULL",
      "IS",
      "LIKE",
      "BETWEEN",
      "EXISTS",
      "CASE",
      "WHEN",
      "THEN",
      "ELSE",
      "END",
      "DISTINCT",
      "COUNT",
      "SUM",
      "AVG",
      "MIN",
      "MAX",
      "UNION",
      "ALL",
      "WITH",
      "RETURNING",
      "CASCADE",
      "PRIMARY",
      "KEY",
      "FOREIGN",
      "REFERENCES",
      "CONSTRAINT",
      "DEFAULT",
      "CHECK",
      "UNIQUE",
      "IF",
      "BEGIN",
      "COMMIT",
      "ROLLBACK",
      "TRANSACTION",
      "GRANT",
      "REVOKE",
      "BOOLEAN",
      "INTEGER",
      "VARCHAR",
      "TEXT",
      "TIMESTAMP",
      "SERIAL",
      "BIGSERIAL",
      "BIGINT",
      "SMALLINT",
      "REAL",
      "FLOAT",
      "NUMERIC",
      "DECIMAL",
      "DATE",
      "TIME",
      "JSON",
      "JSONB",
      "UUID",
      "ASC",
      "DESC",
      "TRUE",
      "FALSE",
    ];

    let formatted = value;
    // Uppercase SQL keywords (word boundary matching)
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      formatted = formatted.replace(regex, kw);
    }
    // Add newlines before major clauses
    const clauseKeywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "GROUP BY",
      "ORDER BY",
      "HAVING",
      "LIMIT",
      "OFFSET",
      "LEFT JOIN",
      "RIGHT JOIN",
      "INNER JOIN",
      "OUTER JOIN",
      "JOIN",
      "ON",
      "SET",
      "VALUES",
      "RETURNING",
    ];
    for (const clause of clauseKeywords) {
      const regex = new RegExp(`\\s+${clause.replace(" ", "\\s+")}\\b`, "g");
      formatted = formatted.replace(regex, `\n${clause}`);
    }
    // Clean up multiple blank lines
    formatted = formatted.replace(/\n{3,}/g, "\n\n").trim();

    onChange(formatted);
  }, [value, onChange]);

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* Database context indicator */}
      {database && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">
            Banco de dados:
          </span>
          <span className="text-xs font-medium text-foreground">
            {database}
          </span>
        </div>
      )}

      {/* Editor */}
      <MonacoEditor
        height={height}
        language="sql"
        theme="vs-dark"
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          folding: false,
          renderLineHighlight: "line",
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onRun}
            disabled={isRunning || !value.trim()}
            className="gap-1.5"
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Executar
          </Button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Ctrl+Enter
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            disabled={!value.trim()}
            title="Formatar SQL"
          >
            <AlignLeft className="h-3.5 w-3.5" />
            <span className="ml-1.5 hidden sm:inline">Formatar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!value.trim()}
            title="Limpar editor"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="ml-1.5 hidden sm:inline">Limpar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
