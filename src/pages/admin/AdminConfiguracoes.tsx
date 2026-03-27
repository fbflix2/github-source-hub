import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  X,
  SquarePen,
  Trash2,
  ShieldCheck,
  Shield,
  Settings,
  Loader2,
  Crown,
  UserCog,
  KeyRound,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ModeratorPermissionsModal from "@/components/admin/ModeratorPermissionsModal";
interface TeamMember {
  user_id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  status: string;
  avatar_url: string | null;
  created_at: string;
  department: string | null;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  moderator: "Moderador",
};

const roleOptions = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema" },
  { value: "moderator", label: "Moderador", description: "Acesso a conteúdo e suporte" },
];

export default function AdminConfiguracoes() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // Add member modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("moderator");
  const [addLoading, setAddLoading] = useState(false);

  // Edit role modal
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState("");

  // Remove confirm
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);

  // Permissions modal
  const [permsMember, setPermsMember] = useState<TeamMember | null>(null);

  // Department editing
  const [deptMember, setDeptMember] = useState<TeamMember | null>(null);
  const [deptValue, setDeptValue] = useState("");

  const filters = [
    { key: "all", label: "Todos" },
    { key: "admin", label: "Administradores" },
    { key: "moderator", label: "Moderadores" },
  ];

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        method: "GET",
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setMembers(data.members || []);
    } catch (err: any) {
      toast.error("Erro ao carregar membros: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAdd = async () => {
    if (!addEmail.trim()) {
      toast.error("Digite o email do membro");
      return;
    }
    setAddLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: { action: "add", email: addEmail.trim(), role: addRole },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Membro adicionado com sucesso!");
      setShowAddModal(false);
      setAddEmail("");
      setAddRole("moderator");
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editMember) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "update_role",
          user_id: editMember.user_id,
          old_role: editMember.role,
          new_role: editRole,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Função atualizada!");
      setEditMember(null);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemove = async () => {
    if (!removeMember) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "remove",
          user_id: removeMember.user_id,
          role: removeMember.role,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Membro removido da equipe!");
      setRemoveMember(null);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getRoleBadgeStyles = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "moderator":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "all" || member.role === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Role stats
  const adminCount = members.filter((m) => m.role === "admin").length;
  const modCount = members.filter((m) => m.role === "moderator").length;

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Settings className="w-4 h-4" />
            <span>Administração</span>
            <span className="text-gray-600">/</span>
            <span>Configurações</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Usuários e Acessos
          </h1>
          <p className="text-gray-400 text-base max-w-2xl">
            Gerencie membros da equipe, permissões e níveis de segurança do sistema FBFLIX.
          </p>
        </div>
      </header>

      {/* Team Members */}
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Membros da Equipe
            <span className="text-sm font-normal text-gray-500 ml-2">({members.length})</span>
          </h2>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Adicionar Novo Membro
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/30 border-white/10 text-sm placeholder:text-gray-500 focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-sm font-medium whitespace-nowrap ${
                  activeFilter === filter.key
                    ? "bg-white/10 border-white/10 text-white"
                    : "bg-transparent border-white/10 hover:bg-white/5 text-gray-300"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-3 text-gray-400">Carregando membros...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {members.length === 0
              ? "Nenhum membro encontrado na equipe."
              : "Nenhum resultado para a busca."}
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                  <th className="p-4 font-semibold">Membro</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">Nível de Acesso</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {filteredMembers.map((member) => (
                  <tr key={`${member.user_id}-${member.role}`} className="group hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-900 text-gray-300 text-sm font-bold">
                            {member.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{member.name}</span>
                          {member.department && (
                            <span className="text-[10px] font-medium text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded w-fit mt-0.5">
                              {member.department}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            Desde {formatDate(member.created_at)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{member.email}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeStyles(member.role)}`}
                      >
                        {roleLabels[member.role] || member.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            member.status === "active"
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                              : "bg-red-500"
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            member.status === "active" ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {member.status === "active" ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {member.role === "moderator" && (
                          <button
                            onClick={() => setPermsMember(member)}
                            className="p-2 hover:bg-blue-500/20 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                            title="Configurar Permissões"
                          >
                            <KeyRound className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDeptMember(member);
                            setDeptValue(member.department || "");
                          }}
                          className="p-2 hover:bg-emerald-500/20 rounded-lg text-gray-400 hover:text-emerald-400 transition-colors"
                          title="Definir Setor"
                        >
                          <Building2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditMember(member);
                            setEditRole(member.role);
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                          title="Alterar Função"
                        >
                          <SquarePen className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setRemoveMember(member)}
                          className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                          title="Remover da Equipe"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
          <p>Mostrando {filteredMembers.length} de {members.length} membros</p>
        </div>
      </section>

      {/* Roles Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Administradores</h3>
              <p className="text-xs text-gray-400">Acesso total ao sistema, financeiro e configurações.</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded text-gray-300">
              {adminCount} {adminCount === 1 ? "Usuário" : "Usuários"}
            </span>
          </div>
        </div>

        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Moderadores</h3>
              <p className="text-xs text-gray-400">Acesso a conteúdo, suporte e gestão de clientes.</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded text-gray-300">
              {modCount} {modCount === 1 ? "Usuário" : "Usuários"}
            </span>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Adicionar Novo Membro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">Email do Usuário</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="bg-black/30 border-white/10 text-white placeholder:text-gray-500"
              />
              <p className="text-xs text-gray-500">O usuário precisa já ter uma conta cadastrada.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">Função</label>
              <div className="space-y-2">
                {roleOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      addRole === opt.value
                        ? "border-primary/50 bg-primary/5"
                        : "border-white/10 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name="addRole"
                      value={opt.value}
                      checked={addRole === opt.value}
                      onChange={(e) => setAddRole(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        addRole === opt.value ? "border-primary" : "border-gray-600"
                      }`}
                    >
                      {addRole === opt.value && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white">{opt.label}</span>
                      <span className="block text-xs text-gray-500">{opt.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              className="border-white/10 text-gray-300 hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={addLoading}
              className="bg-primary hover:bg-red-700 text-white"
            >
              {addLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adicionando...
                </>
              ) : (
                "Adicionar Membro"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SquarePen className="w-5 h-5 text-primary" />
              Alterar Função
            </DialogTitle>
          </DialogHeader>
          {editMember && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-900 text-gray-300 text-sm font-bold">
                    {editMember.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-white">{editMember.name}</p>
                  <p className="text-xs text-gray-400">{editMember.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Nova Função</label>
                <div className="space-y-2">
                  {roleOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        editRole === opt.value
                          ? "border-primary/50 bg-primary/5"
                          : "border-white/10 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="radio"
                        name="editRole"
                        value={opt.value}
                        checked={editRole === opt.value}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          editRole === opt.value ? "border-primary" : "border-gray-600"
                        }`}
                      >
                        {editRole === opt.value && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white">{opt.label}</span>
                        <span className="block text-xs text-gray-500">{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditMember(null)}
              className="border-white/10 text-gray-300 hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={editRole === editMember?.role}
              className="bg-primary hover:bg-red-700 text-white"
            >
              Salvar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <AlertDialog open={!!removeMember} onOpenChange={(open) => !open && setRemoveMember(null)}>
        <AlertDialogContent className="bg-gray-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro da equipe?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {removeMember && (
                <>
                  <strong className="text-white">{removeMember.name}</strong> ({removeMember.email})
                  perderá o acesso de <strong className="text-white">{roleLabels[removeMember.role]}</strong> ao
                  painel administrativo. Essa ação pode ser revertida adicionando o membro novamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-gray-300 hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover Membro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Moderator Permissions Modal */}
      <ModeratorPermissionsModal
        open={!!permsMember}
        onClose={() => setPermsMember(null)}
        member={permsMember}
      />
    </div>
  );
}
