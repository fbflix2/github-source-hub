import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

const allMenuOptions = [
  { path: "/admin", label: "Dashboard" },
  { path: "/admin/suporte", label: "Suporte" },
  { path: "/admin/auditoria", label: "Auditoria" },
  { path: "/admin/auditoria/nova-compra", label: "Auditoria > Nova Compra" },
  { path: "/admin/auditoria/nova-venda", label: "Auditoria > Nova Venda" },
  { path: "/admin/auditoria/balanco", label: "Auditoria > Balanço" },
  { path: "/admin/auditoria/centro-custos", label: "Auditoria > Centro de Custos" },
  { path: "/admin/estoque", label: "Estoque" },
  { path: "/admin/blocagem", label: "Blocagem" },
  { path: "/admin/reciclagem", label: "Reciclagem" },
  { path: "/admin/reposicoes", label: "Reposições" },
  { path: "/admin/trocas", label: "Trocas" },
  { path: "/admin/gestao-bms", label: "Gestão de BMs" },
  { path: "/admin/produtos", label: "Produtos" },
  { path: "/admin/pedidos", label: "Pedidos" },
  { path: "/admin/pagamentos", label: "Pagamentos" },
  { path: "/admin/carrinhos-abandonados", label: "Carrinhos Abandonados" },
  { path: "/admin/assinaturas", label: "Assinaturas" },
  { path: "/admin/central-proxy", label: "Central Proxy" },
  { path: "/admin/clientes", label: "Clientes" },
  { path: "/admin/clientes/ativos", label: "Clientes Ativos" },
  { path: "/admin/parceiros", label: "Parceiros" },
  { path: "/admin/afiliados", label: "Afiliados" },
  { path: "/admin/cupons", label: "Cupons" },
  { path: "/admin/anuncios", label: "Anúncios" },
  { path: "/admin/notificacoes", label: "Notificações" },
  { path: "/admin/chat", label: "Chat da Equipe" },
  { path: "/admin/configuracoes/plataforma", label: "Configurações > Plataforma" },
  { path: "/admin/configuracoes/bloco-padrao", label: "Configurações > Bloco Padrão" },
  { path: "/admin/configuracoes/feedbacks", label: "Configurações > Feedbacks" },
  { path: "/admin/configuracoes/usuarios", label: "Configurações > Usuários" },
  { path: "/admin/banners", label: "Configurações > Banners" },
  { path: "/admin/tutoriais", label: "Configurações > Tutoriais" },
  { path: "/admin/termos", label: "Configurações > Termos de uso" },
  { path: "/admin/api", label: "Configurações > API | Token" },
];

interface ModeratorPermissionsModalProps {
  open: boolean;
  onClose: () => void;
  member: { user_id: string; name: string; email: string } | null;
}

export default function ModeratorPermissionsModal({ open, onClose, member }: ModeratorPermissionsModalProps) {
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && member) {
      fetchPermissions();
    }
  }, [open, member]);

  const fetchPermissions = async () => {
    if (!member) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: { action: "get_permissions", user_id: member.user_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAllowedPaths(data.allowed_paths || []);
    } catch (err: any) {
      toast.error("Erro ao carregar permissões: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (path: string) => {
    setAllowedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSelectAll = () => {
    if (allowedPaths.length === allMenuOptions.length) {
      setAllowedPaths([]);
    } else {
      setAllowedPaths(allMenuOptions.map(o => o.path));
    }
  };

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: { action: "set_permissions", user_id: member.user_id, allowed_paths: allowedPaths },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Permissões salvas com sucesso!");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Permissões de {member.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 py-2 pr-1">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
              <span className="text-sm text-gray-400">Selecione as telas permitidas</span>
              <button
                onClick={handleSelectAll}
                className="text-xs text-primary hover:underline"
              >
                {allowedPaths.length === allMenuOptions.length ? "Desmarcar tudo" : "Selecionar tudo"}
              </button>
            </div>
            {allMenuOptions.map((option) => (
              <label
                key={option.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={allowedPaths.includes(option.path)}
                  onCheckedChange={() => handleToggle(option.path)}
                  className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span className="text-sm text-gray-200">{option.label}</span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-red-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
