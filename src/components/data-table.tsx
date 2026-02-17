"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export interface ColumnDef {
  name: string;
  type: string;
}

export type RowData = Record<string, unknown>;

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string;
  direction: SortDirection;
}

interface DataTableProps {
  columns: ColumnDef[];
  data: RowData[];
  totalRows: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSort?: (column: string, direction: SortDirection) => void;
  onEdit?: (rowIndex: number, row: RowData) => void;
  onDelete?: (rowIndex: number, row: RowData) => void;
  onInsert?: () => void;
  isLoading?: boolean;
}

interface EditableCellProps {
  value: unknown;
  onSave: (newValue: string) => void;
  onCancel: () => void;
}

function EditableCell({ value, onSave, onCancel }: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(String(value ?? ""));

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave(editValue);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(editValue)}
      className="h-7 min-w-[80px] text-xs"
    />
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataTable({
  columns,
  data,
  totalRows,
  page,
  pageSize,
  onPageChange,
  onSort,
  onEdit,
  onDelete,
  onInsert,
  isLoading = false,
}: DataTableProps) {
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    colName: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    rowIdx: number;
    row: RowData;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  const handleSort = useCallback(
    (column: string) => {
      let direction: SortDirection;
      if (sort.column === column) {
        if (sort.direction === "asc") direction = "desc";
        else if (sort.direction === "desc") direction = null;
        else direction = "asc";
      } else {
        direction = "asc";
      }
      setSort({ column, direction });
      onSort?.(column, direction);
    },
    [sort, onSort]
  );

  const handleCellClick = useCallback(
    (rowIdx: number, colName: string) => {
      if (onEdit) {
        setEditingCell({ rowIdx, colName });
      }
    },
    [onEdit]
  );

  const handleCellSave = useCallback(
    (rowIdx: number, colName: string, newValue: string) => {
      setEditingCell(null);
      if (onEdit && data[rowIdx]) {
        const originalValue = String(data[rowIdx][colName] ?? "");
        // Only trigger edit if value actually changed
        if (newValue !== originalValue) {
          const row = { ...data[rowIdx], [colName]: newValue };
          onEdit(rowIdx, row);
        }
      }
    },
    [data, onEdit]
  );

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirm && onDelete) {
      onDelete(deleteConfirm.rowIdx, deleteConfirm.row);
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, onDelete]);

  const exportCSV = useCallback(() => {
    if (data.length === 0 || columns.length === 0) return;

    const headers = columns.map((c) => c.name);
    const rows = data.map((row) =>
      columns.map((c) => {
        const val = formatCellValue(row[c.name]);
        // Escape quotes and wrap in quotes if contains comma/newline/quote
        if (val.includes(",") || val.includes("\n") || val.includes('"')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
    );

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `export_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [data, columns]);

  const exportJSON = useCallback(() => {
    if (data.length === 0) return;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `export_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const getSortIcon = (column: string) => {
    if (sort.column !== column || sort.direction === null) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    if (sort.direction === "asc") {
      return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
    }
    return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  };

  // Skeleton rows for loading state
  const skeletonRows = Array.from({ length: pageSize }, (_, i) => i);

  return (
    <div className="space-y-3">
      {/* Top bar: Insert + Export */}
      <div className="flex items-center justify-between">
        <div>
          {onInsert && (
            <Button size="sm" onClick={onInsert} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Inserir Registro
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={data.length === 0}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportJSON}
            disabled={data.length === 0}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.name}
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort(col.name)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.name}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {col.type}
                    </span>
                    {getSortIcon(col.name)}
                  </div>
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead className="w-[100px] text-right">Acoes</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              skeletonRows.map((i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <TableCell key={`skeleton-${i}-${col.name}`}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell>
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Database className="h-8 w-8" />
                    <span>Nenhum registro encontrado</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {columns.map((col) => (
                    <TableCell
                      key={`${rowIdx}-${col.name}`}
                      className={cn(
                        "max-w-[300px] truncate",
                        onEdit && "cursor-pointer hover:bg-muted/50"
                      )}
                      onClick={() => handleCellClick(rowIdx, col.name)}
                      title={formatCellValue(row[col.name])}
                    >
                      {editingCell?.rowIdx === rowIdx &&
                      editingCell?.colName === col.name ? (
                        <EditableCell
                          value={row[col.name]}
                          onSave={(val) =>
                            handleCellSave(rowIdx, col.name, val)
                          }
                          onCancel={handleCellCancel}
                        />
                      ) : (
                        <span
                          className={cn(
                            "text-sm",
                            (row[col.name] === null ||
                              row[col.name] === undefined) &&
                              "italic text-muted-foreground"
                          )}
                        >
                          {formatCellValue(row[col.name])}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ rowIdx, row });
                            }}
                            title="Excluir registro"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {totalRows > 0 ? (
            <>
              {startRow} - {endRow} de {totalRows} registros
            </>
          ) : (
            "0 registros"
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Linhas:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                // Reset to page 1 when changing page size
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este registro? Esta acao nao pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
