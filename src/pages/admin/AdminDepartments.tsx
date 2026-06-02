import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Loader2, Users } from "lucide-react";

type Department = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number;
  active: boolean;
};

type StaffMember = {
  user_id: string;
  full_name: string | null;
  department_id: string | null;
  role: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function AdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#22c55e");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: deps }, { data: roles }] = await Promise.all([
      supabase.from("departments" as any).select("*").order("sort_order", { ascending: true }),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "moderator"]),
    ]);
    const userIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    let profs: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, department_id")
        .in("user_id", userIds);
      profs = data ?? [];
    }
    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
    setDepartments((deps as any) ?? []);
    setStaff(
      profs.map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        department_id: p.department_id,
        role: roleMap.get(p.user_id) ?? "moderator",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const slug = slugify(newName);
    const { error } = await supabase.from("departments" as any).insert({
      name: newName.trim(),
      slug,
      color: newColor,
      sort_order: (departments.at(-1)?.sort_order ?? 0) + 1,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    setNewName("");
    fetchData();
    toast.success("Departamento criado");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este departamento? Atendentes ligados ficarão sem departamento.")) return;
    const { error } = await supabase.from("departments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchData();
  };

  const handleAssign = async (userId: string, departmentId: string | null) => {
    const { error } = await supabase
      .from("profiles")
      .update({ department_id: departmentId } as any)
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    setStaff((prev) => prev.map((s) => (s.user_id === userId ? { ...s, department_id: departmentId } : s)));
    toast.success("Departamento atualizado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Building2 className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departamentos</h1>
          <p className="text-sm text-muted-foreground">Organize sua equipe por área de atendimento</p>
        </div>
      </div>

      {/* Departments list */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Lista de Departamentos</h2>
          <span className="text-xs text-muted-foreground">{departments.length} total</span>
        </div>

        <div className="flex gap-2 items-end p-3 rounded-lg bg-muted/30 border border-border/40">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Comercial, Suporte, Parcerias..."
              className="mt-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cor</label>
            <Input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="mt-1 w-16 h-10 p-1"
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Criar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {departments.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 p-3 rounded-lg border border-border/40 bg-card/40"
              >
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: d.color || "#22c55e" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{d.slug}</p>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remover"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Staff assignment */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="font-semibold text-foreground">Atendentes</h2>
          <span className="text-xs text-muted-foreground">({staff.length})</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendente cadastrado.</p>
        ) : (
          <div className="divide-y divide-border/30">
            {staff.map((s) => (
              <div key={s.user_id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.full_name || s.user_id.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{s.role}</p>
                </div>
                <Select
                  value={s.department_id ?? "__none__"}
                  onValueChange={(v) => handleAssign(s.user_id, v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="w-48 h-9 text-xs">
                    <SelectValue placeholder="Sem departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem departamento</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}