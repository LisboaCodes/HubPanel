"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ShieldX,
  UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";

interface PgUser {
  username: string;
  is_superuser: boolean;
  can_create_db: boolean;
  can_create_role: boolean;
  can_login: boolean;
  is_replication: boolean;
  connection_limit: number;
  valid_until: string | null;
}

export default function UsersPage() {
  const params = useParams();
  const dbName = params.db as string;

  const [users, setUsers] = useState<PgUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create user form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);

  const availablePermissions = [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "CREATE",
    "ALL PRIVILEGES",
  ];

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/users?db=${encodeURIComponent(dbName)}`
      );
      if (res.ok) {
        const data: PgUser[] = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbName]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast({
        title: "Erro",
        description: "Nome de usuario e senha sao obrigatorios",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: dbName,
          username: newUsername.trim(),
          password: newPassword,
          permissions,
        }),
      });

      if (res.ok) {
        toast({
          title: "Sucesso",
          description: `Usuario "${newUsername}" criado com sucesso`,
        });
        setShowCreateDialog(false);
        setNewUsername("");
        setNewPassword("");
        setPermissions([]);
        fetchUsers();
      } else {
        const data = await res.json();
        toast({
          title: "Erro",
          description: data.error || "Erro ao criar usuario",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao ao criar usuario",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: dbName,
          username: selectedUser,
        }),
      });

      if (res.ok) {
        toast({
          title: "Sucesso",
          description: `Usuario "${selectedUser}" removido com sucesso`,
        });
        setShowDeleteDialog(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        toast({
          title: "Erro",
          description: data.error || "Erro ao remover usuario",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro de conexao ao remover usuario",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
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
              onClick={fetchUsers}
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
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              className="gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Criar Usuario
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Roles do PostgreSQL
            </CardTitle>
            <CardDescription>
              Usuarios e roles configurados no servidor
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Users className="h-10 w-10" />
                <p className="text-sm">Nenhum usuario encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Superuser</TableHead>
                    <TableHead>Criar BD</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Limite Conexoes</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.username}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.is_superuser ? (
                            <ShieldCheck className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <Users className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.is_superuser ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {user.is_superuser ? "Sim" : "Nao"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.can_create_db ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {user.can_create_db ? "Sim" : "Nao"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.can_login ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {user.can_login ? "Sim" : "Nao"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.connection_limit === -1
                          ? "Ilimitado"
                          : user.connection_limit}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedUser(user.username);
                            setShowDeleteDialog(true);
                          }}
                          title="Excluir usuario"
                          disabled={user.is_superuser}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Usuario</DialogTitle>
              <DialogDescription>
                Criar um novo role PostgreSQL com permissao de login
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">Nome de usuario</Label>
                <Input
                  id="new-username"
                  placeholder="meu_usuario"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use apenas letras, numeros e underscores
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Senha segura"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Permissoes nas tabelas</Label>
                <div className="flex flex-wrap gap-2">
                  {availablePermissions.map((perm) => (
                    <button
                      key={perm}
                      type="button"
                      onClick={() => togglePermission(perm)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        permissions.includes(perm)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {perm}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleCreateUser}
                disabled={isCreating || !newUsername.trim() || !newPassword.trim()}
                className="gap-1.5"
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar exclusao</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja remover o usuario{" "}
                <span className="font-medium text-foreground">
                  {selectedUser}
                </span>
                ? Todas as permissoes serao revogadas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="gap-1.5"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
