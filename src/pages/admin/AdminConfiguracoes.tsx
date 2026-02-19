import { useState } from "react";
import {
  Users,
  Plus,
  Search,
  X,
  SquarePen,
  KeyRound,
  Trash2,
  ShieldCheck,
  Shield,
  FileEdit,
  Headset,
  PlusCircle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  roleType: "admin" | "editor" | "support";
  status: "active" | "inactive";
  createdAt: string;
}

interface AccessLevel {
  id: string;
  name: string;
  description: string;
  userCount: number;
  icon: "admin" | "editor" | "support";
}

const mockMembers: TeamMember[] = [
  {
    id: "1",
    name: "Ana Silva",
    initials: "AS",
    email: "ana.silva@fbflix.com",
    role: "Administrador Global",
    roleType: "admin",
    status: "active",
    createdAt: "12 Jan 2023",
  },
  {
    id: "2",
    name: "Carlos Mendez",
    initials: "CM",
    email: "carlos.m@fbflix.com",
    role: "Editor de Conteúdo",
    roleType: "editor",
    status: "active",
    createdAt: "24 Fev 2023",
  },
  {
    id: "3",
    name: "João Pereira",
    initials: "JP",
    email: "joao.p@fbflix.com",
    role: "Suporte N1",
    roleType: "support",
    status: "inactive",
    createdAt: "05 Mar 2023",
  },
];

const mockAccessLevels: AccessLevel[] = [
  {
    id: "1",
    name: "Administrador Global",
    description: "Acesso total a todas as funcionalidades do sistema, incluindo financeiro.",
    userCount: 3,
    icon: "admin",
  },
  {
    id: "2",
    name: "Editor de Conteúdo",
    description: "Pode criar, editar e excluir filmes, séries e categorias.",
    userCount: 8,
    icon: "editor",
  },
  {
    id: "3",
    name: "Suporte N1",
    description: "Acesso limitado a tickets de suporte e reset de senhas de usuários finais.",
    userCount: 12,
    icon: "support",
  },
];

const permissions = [
  { id: "users", label: "Gerenciar Usuários", description: "Criar, editar e remover membros." },
  { id: "content", label: "Gerenciar Conteúdo", description: "Adicionar e editar filmes/séries." },
  { id: "analytics", label: "Acessar Analytics", description: "Visualizar dashboards de dados." },
  { id: "payments", label: "Configurações de Pagamento", description: "Acesso a gateways e faturas." },
];

export default function AdminConfiguracoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["content"]);
  const [newLevelName, setNewLevelName] = useState("");

  const filters = [
    { key: "all", label: "Todos" },
    { key: "admin", label: "Administradores" },
    { key: "editor", label: "Editores" },
    { key: "support", label: "Suporte" },
  ];

  const getRoleBadgeStyles = (roleType: string) => {
    switch (roleType) {
      case "admin":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "editor":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "support":
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const getAccessLevelIcon = (icon: string) => {
    switch (icon) {
      case "admin":
        return <Settings className="w-5 h-5" />;
      case "editor":
        return <FileEdit className="w-5 h-5" />;
      case "support":
        return <Headset className="w-5 h-5" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  };

  const getAccessLevelIconStyles = (icon: string) => {
    switch (icon) {
      case "admin":
        return "bg-red-500/10 text-red-500";
      case "editor":
        return "bg-blue-500/10 text-blue-500";
      case "support":
        return "bg-orange-500/10 text-orange-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  const togglePermission = (id: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredMembers = mockMembers.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "all" || member.roleType === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header Section */}
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
        <button className="group flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Content */}
      <div className="flex flex-col gap-8">
        {/* Team Members Section */}
        <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Membros da Equipe
            </h2>
            <Button className="bg-primary hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-5 h-5" />
              Adicionar Novo Membro
            </Button>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Buscar por nome, email ou cargo..."
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
                  <tr key={member.id} className="group hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-900 text-gray-300 text-sm font-bold">
                            {member.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span
                            className={`font-semibold ${
                              member.status === "active" ? "text-white" : "text-gray-400"
                            }`}
                          >
                            {member.name}
                          </span>
                          <span
                            className={`text-xs ${
                              member.status === "active" ? "text-gray-500" : "text-gray-600"
                            }`}
                          >
                            Criado em {member.createdAt}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td
                      className={`p-4 ${
                        member.status === "active" ? "text-gray-300" : "text-gray-500"
                      }`}
                    >
                      {member.email}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeStyles(
                          member.roleType
                        )}`}
                      >
                        {member.role}
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
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                          title="Editar Permissões"
                        >
                          <SquarePen className="w-5 h-5" />
                        </button>
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                          title="Resetar Senha"
                        >
                          <KeyRound className="w-5 h-5" />
                        </button>
                        <button
                          className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                          title="Remover Usuário"
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

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
            <p>Mostrando 1 a {filteredMembers.length} de 12 membros</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed">
                Anterior
              </button>
              <button className="px-3 py-1 rounded-lg border border-white/10 hover:bg-white/5 bg-white/5 text-white">
                Próximo
              </button>
            </div>
          </div>
        </section>

        {/* Access Level Management (Split View) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create New Access Level */}
          <section className="lg:col-span-1 bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8 flex flex-col h-full">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Criar Nível de Acesso
            </h2>
            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Nível</label>
                <Input
                  type="text"
                  placeholder="Ex: Moderador de Comentários"
                  value={newLevelName}
                  onChange={(e) => setNewLevelName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/30 border-white/10 text-sm placeholder:text-gray-500 focus:border-primary focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Permissões</label>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {permissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5 transition-colors"
                    >
                      <Checkbox
                        checked={selectedPermissions.includes(permission.id)}
                        onCheckedChange={() => togglePermission(permission.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="text-sm">
                        <span className="block text-white font-medium">{permission.label}</span>
                        <span className="block text-gray-500 text-xs">{permission.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/10">
              <Button className="w-full bg-white text-black hover:bg-gray-200 font-bold py-3 px-6 rounded-xl">
                Salvar Novo Nível
              </Button>
            </div>
          </section>

          {/* Existing Access Levels List */}
          <section className="lg:col-span-2 bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-primary" />
              Níveis de Acesso Existentes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockAccessLevels.map((level) => (
                <div
                  key={level.id}
                  className="group relative p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${getAccessLevelIconStyles(level.icon)}`}>
                      {getAccessLevelIcon(level.icon)}
                    </div>
                    <h3 className="font-bold text-lg">{level.name}</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4 h-8 line-clamp-2">{level.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded text-gray-300">
                      {level.userCount} Usuários
                    </span>
                    <button className="text-sm text-primary hover:text-red-400 font-semibold">
                      Editar Permissões
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Card */}
              <div className="group flex flex-col items-center justify-center p-5 rounded-xl border border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer h-full min-h-[160px]">
                <PlusCircle className="w-10 h-10 text-gray-500 group-hover:text-primary mb-2" />
                <span className="text-sm font-medium text-gray-400 group-hover:text-primary">
                  Adicionar Rápido
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
