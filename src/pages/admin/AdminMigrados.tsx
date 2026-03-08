import { useState, useEffect } from "react";
import { Loader2, Users, ArrowDownRight, Mail, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MigratedUser {
  id: string;
  email: string;
  full_name: string | null;
  migrated_at: string;
  last_sign_in_at: string | null;
  password_changed: boolean;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminMigrados() {
  const [users, setUsers] = useState<MigratedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMigrated();
  }, []);

  async function fetchMigrated() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const { data, error } = await supabase.functions.invoke("migration-login", {
        body: { action: "list-migrated" },
      });

      if (error) throw error;

      // Sort by migrated_at descending
      const sorted = (data.users || []).sort(
        (a: MigratedUser, b: MigratedUser) =>
          new Date(b.migrated_at).getTime() - new Date(a.migrated_at).getTime()
      );
      setUsers(sorted);
    } catch (err: any) {
      toast.error("Erro ao carregar: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground lg:text-5xl">
            Clientes Migrados
          </h1>
          <p className="text-base font-light text-muted-foreground">
            Usuários que acessaram via tela de migração de conta.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ArrowDownRight className="size-5 text-primary" />
          <span className="font-bold text-foreground text-lg">{users.length}</span> migrados
        </div>
      </div>

      {users.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <AlertCircle className="mx-auto size-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-lg">Nenhum usuário migrado encontrado.</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5" />
                      Email
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5" />
                      Nome
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5" />
                      Migrado em
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Último Login
                  </TableHead>
                  <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Senha
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border text-sm">
                {users.map((u) => (
                  <TableRow key={u.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="px-6 py-4 font-mono text-sm text-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell className="px-6 py-4 font-medium text-foreground">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                      {formatDate(u.migrated_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                      {formatDate(u.last_sign_in_at)}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {u.password_changed ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
                          <CheckCircle2 className="size-3" />
                          Definida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset bg-amber-500/10 text-amber-400 ring-amber-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Pendente
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
