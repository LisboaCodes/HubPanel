"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  RefreshCw,
  Loader2,
  Plus,
  Columns3,
  Rows3,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef, type RowData } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: string;
  column_default: string | null;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  columns: string[];
}

interface IndexInfo {
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  definition: string;
}

interface TableStructure {
  columns: ColumnInfo[];
  constraints: ConstraintInfo[];
  indexes: IndexInfo[];
}

interface TableDataResponse {
  rows: RowData[];
  fields: { name: string; dataTypeID: number }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const CONSTRAINT_LABELS: Record<string, string> = {
  p: "PRIMARY KEY",
  f: "FOREIGN KEY",
  u: "UNIQUE",
  c: "CHECK",
  x: "EXCLUSION",
};

export default function TableDetailPage() {
  const params = useParams();
  const dbName = params.db as string;
  const tableName = params.table as string;

  const [structure, setStructure] = useState<TableStructure | null>(null);
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [insertValues, setInsertValues] = useState<Record<string, string>>({});
  const [isInserting, setIsInserting] = useState(false);

  const pageSize = 50;

  const fetchStructure = useCallback(async () => {
    setIsLoadingStructure(true);
    try {
      const res = await fetch(
        `/api/tables?db=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}`
      );
      if (res.ok) {
        const data: TableStructure = await res.json();
        setStructure(data);

        // Find primary key
        const pkConstraint = data.constraints.find(
          (c) => c.constraint_type === "p"
        );
        if (pkConstraint && pkConstraint.columns.length > 0) {
          setPrimaryKey(pkConstraint.columns[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching table structure:", error);
    } finally {
      setIsLoadingStructure(false);
    }
  }, [dbName, tableName]);

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams({
        db: dbName,
        table: tableName,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (sortColumn) {
        params.set("orderBy", sortColumn);
        params.set("orderDir", sortDir);
      }

      const res = await fetch(`/api/tables/data?${params.toString()}`);
      if (res.ok) {
        const data: TableDataResponse = await res.json();
        setTableData(data);
      }
    } catch (error) {
      console.error("Error fetching table data:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [dbName, tableName, page, sortColumn, sortDir]);

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (column: string, direction: "asc" | "desc" | null) => {
    if (direction === null) {
      setSortColumn(undefined);
      setSortDir("ASC");
    } else {
      setSortColumn(column);
      setSortDir(direction === "asc" ? "ASC" : "DESC");
    }
    setPage(1);
  };

  const handleEdit = async (_rowIdx: number, row: RowData) => {
    if (!primaryKey) {
      toast({
        title: "Erro",
        description: "Tabela sem chave primaria - edicao nao disponivel",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/tables/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: dbName,
          table: tableName,
          primaryKey,
          pkValue: row[primaryKey],
          data: row,
        }),
      });

      if (res.ok) {
        toast({ title: "Sucesso", description: "Registro atualizado" });
        fetchData();
      } else {
        const err = await res.json();
        toast({
          title: "Erro",
          description: err.error || "Erro ao atualizar registro",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao ao atualizar",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (_rowIdx: number, row: RowData) => {
    if (!primaryKey) {
      toast({
        title: "Erro",
        description: "Tabela sem chave primaria - exclusao nao disponivel",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/tables/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: dbName,
          table: tableName,
          primaryKey,
          pkValue: row[primaryKey],
        }),
      });

      if (res.ok) {
        toast({ title: "Sucesso", description: "Registro excluido" });
        fetchData();
      } else {
        const err = await res.json();
        toast({
          title: "Erro",
          description: err.error || "Erro ao excluir registro",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao ao excluir",
        variant: "destructive",
      });
    }
  };

  const handleInsert = async () => {
    setIsInserting(true);
    try {
      // Filter out empty values
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(insertValues)) {
        if (value.trim() !== "") {
          data[key] = value;
        }
      }

      const res = await fetch("/api/tables/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: dbName,
          table: tableName,
          data,
        }),
      });

      if (res.ok) {
        toast({ title: "Sucesso", description: "Registro inserido" });
        setShowInsertDialog(false);
        setInsertValues({});
        fetchData();
      } else {
        const err = await res.json();
        toast({
          title: "Erro",
          description: err.error || "Erro ao inserir registro",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao ao inserir",
        variant: "destructive",
      });
    } finally {
      setIsInserting(false);
    }
  };

  const columns: ColumnDef[] = (tableData?.fields ?? []).map((f) => ({
    name: f.name,
    type: "",
  }));

  // Enrich columns with type info from structure
  if (structure) {
    for (const col of columns) {
      const structCol = structure.columns.find(
        (c) => c.column_name === col.name
      );
      if (structCol) {
        col.type = structCol.udt_name;
      }
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {decodeURIComponent(tableName)}
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
            onClick={() => {
              fetchStructure();
              fetchData();
            }}
            disabled={isLoadingStructure || isLoadingData}
            className="gap-1.5"
          >
            {isLoadingStructure || isLoadingData ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
        </div>

        {/* Tabs: Structure / Data */}
        <Tabs defaultValue="data">
          <TabsList>
            <TabsTrigger value="structure" className="gap-1.5">
              <Columns3 className="h-3.5 w-3.5" />
              Estrutura
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5">
              <Rows3 className="h-3.5 w-3.5" />
              Dados
            </TabsTrigger>
          </TabsList>

          {/* Structure Tab */}
          <TabsContent value="structure" className="space-y-4">
            {isLoadingStructure ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </CardContent>
              </Card>
            ) : structure ? (
              <>
                {/* Columns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Colunas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Nulo</TableHead>
                          <TableHead>Padrao</TableHead>
                          <TableHead>Restricoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {structure.columns.map((col) => {
                          const colConstraints = structure.constraints.filter(
                            (c) => c.columns.includes(col.column_name)
                          );
                          return (
                            <TableRow key={col.column_name}>
                              <TableCell className="font-medium font-mono text-sm">
                                {col.column_name}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                {col.data_type}
                                {col.character_maximum_length
                                  ? `(${col.character_maximum_length})`
                                  : ""}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    col.is_nullable === "YES"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {col.is_nullable === "YES" ? "Sim" : "Nao"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                                {col.column_default ?? "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {colConstraints.map((c) => (
                                    <Badge
                                      key={c.constraint_name}
                                      variant="default"
                                      className="text-xs"
                                    >
                                      {CONSTRAINT_LABELS[c.constraint_type] ??
                                        c.constraint_type}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Indexes */}
                {structure.indexes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Indices</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Unico</TableHead>
                            <TableHead>Primario</TableHead>
                            <TableHead>Definicao</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {structure.indexes.map((idx) => (
                            <TableRow key={idx.index_name}>
                              <TableCell className="font-medium font-mono text-sm">
                                {idx.index_name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    idx.is_unique ? "default" : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {idx.is_unique ? "Sim" : "Nao"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    idx.is_primary ? "default" : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {idx.is_primary ? "Sim" : "Nao"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground max-w-[400px] truncate">
                                {idx.definition}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Erro ao carregar estrutura da tabela
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data">
            <DataTable
              columns={columns}
              data={tableData?.rows ?? []}
              totalRows={tableData?.total ?? 0}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onSort={handleSort}
              onEdit={primaryKey ? handleEdit : undefined}
              onDelete={primaryKey ? handleDelete : undefined}
              onInsert={() => {
                setInsertValues({});
                setShowInsertDialog(true);
              }}
              isLoading={isLoadingData}
            />
          </TabsContent>
        </Tabs>

        {/* Insert Dialog */}
        <Dialog open={showInsertDialog} onOpenChange={setShowInsertDialog}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Inserir Registro</DialogTitle>
              <DialogDescription>
                Preencha os campos para adicionar um novo registro na tabela{" "}
                <span className="font-medium">{tableName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {structure?.columns.map((col) => (
                <div key={col.column_name} className="space-y-1.5">
                  <Label htmlFor={`insert-${col.column_name}`} className="flex items-center gap-2">
                    <span>{col.column_name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {col.udt_name}
                    </span>
                    {col.is_nullable === "NO" && !col.column_default && (
                      <span className="text-xs text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    id={`insert-${col.column_name}`}
                    placeholder={
                      col.column_default
                        ? `Padrao: ${col.column_default}`
                        : col.is_nullable === "YES"
                          ? "NULL"
                          : "Obrigatorio"
                    }
                    value={insertValues[col.column_name] ?? ""}
                    onChange={(e) =>
                      setInsertValues((prev) => ({
                        ...prev,
                        [col.column_name]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleInsert}
                disabled={isInserting}
                className="gap-1.5"
              >
                {isInserting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Inserir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
