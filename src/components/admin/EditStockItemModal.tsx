import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Link, Hash, Mail, AtSign, KeyRound, Cookie, FileText, Shield,
  BadgeCheck, Eye, EyeOff, Save, Loader2, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockItem {
  id: string;
  type: string;
  name: string;
  identification: string | null;
  identification_link: string | null;
  status: string;
  data: any;
  created_at: string;
}

interface EditStockItemModalProps {
  item: StockItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditStockItemModal({ item, open, onOpenChange, onSaved }: EditStockItemModalProps) {
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("aguardando");

  // BM fields
  const [bmLink, setBmLink] = useState("");
  const [bmNotes, setBmNotes] = useState("");

  // Perfil fields
  const [formData, setFormData] = useState({
    linkPerfil: "", idPerfil: "", emailAcesso: "", emailAlternativo: "",
    senha: "", token2fa: "", tempoPlataforma: "3-meses", statusAtual: "aquecido",
    cookies: "", descricao: ""
  });

  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    if (item.type === "bm") {
      setBmLink(item.identification_link ?? "");
      setBmNotes(item.data?.notes ?? "");
    } else {
      const d = item.data ?? {};
      setFormData({
        linkPerfil: item.identification_link ?? "",
        idPerfil: item.identification ?? "",
        emailAcesso: d.emailAcesso ?? "",
        emailAlternativo: d.emailAlternativo ?? "",
        senha: d.senha ?? "",
        token2fa: d.token2fa ?? "",
        tempoPlataforma: d.tempoPlataforma ?? "3-meses",
        statusAtual: d.statusAtual ?? "aquecido",
        cookies: d.cookies ?? "",
        descricao: d.descricao ?? "",
      });
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    let updatePayload: any = { status };

    if (item.type === "bm") {
      updatePayload.identification_link = bmLink;
      updatePayload.data = { notes: bmNotes };
    } else {
      updatePayload.name = formData.emailAcesso || `Perfil ${formData.idPerfil}`;
      updatePayload.identification = formData.idPerfil || null;
      updatePayload.identification_link = formData.linkPerfil || null;
      updatePayload.data = {
        emailAcesso: formData.emailAcesso,
        emailAlternativo: formData.emailAlternativo,
        senha: formData.senha,
        token2fa: formData.token2fa,
        tempoPlataforma: formData.tempoPlataforma,
        statusAtual: formData.statusAtual,
        cookies: formData.cookies,
        descricao: formData.descricao,
      };
    }

    const { error } = await supabase.from("stock_items").update(updatePayload).eq("id", item.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Item atualizado!");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">
            Editar {item.type === "bm" ? "BM" : "Perfil"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Status */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-400">Status do Item</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-black/30 border-white/5 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aguardando">Aguardando Cadastro</SelectItem>
                <SelectItem value="revisado">Revisado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {item.type === "bm" ? (
            /* BM Edit */
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-400">URL do BM</label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input value={bmLink} onChange={e => setBmLink(e.target.value)} placeholder="https://business.facebook.com/..." className="pl-10 bg-black/30 border-white/5 text-white" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-400">Notas</label>
                <Textarea value={bmNotes} onChange={e => setBmNotes(e.target.value)} placeholder="Observações..." className="bg-black/30 border-white/5 text-white resize-none h-24" />
              </div>
            </div>
          ) : (
            /* Perfil Edit */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Identificação */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Identificação</h3>
                  </div>
                  {[
                    { label: "Link do Perfil", icon: Link, key: "linkPerfil", placeholder: "https://facebook.com/profile.php?id=..." },
                    { label: "ID do Perfil", icon: Hash, key: "idPerfil", placeholder: "10000843...", mono: true },
                    { label: "Email de Acesso", icon: Mail, key: "emailAcesso", placeholder: "exemplo@fbflix.com" },
                    { label: "Email Alternativo", icon: AtSign, key: "emailAlternativo", placeholder: "recuperacao@email.com" },
                  ].map(f => (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-400">{f.label}</label>
                      <div className="relative">
                        <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input value={(formData as any)[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} placeholder={f.placeholder} className={`pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 ${f.mono ? "font-mono" : ""}`} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Segurança */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Segurança & Status</h3>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-400">Senha de Acesso</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input type={showPassword ? "text" : "password"} value={formData.senha} onChange={e => setFormData({ ...formData, senha: e.target.value })} placeholder="••••••••••••" className="pl-10 pr-10 bg-black/30 border-white/5 text-white" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                        {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-zinc-400">Token 2FA</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input value={formData.token2fa} onChange={e => setFormData({ ...formData, token2fa: e.target.value })} placeholder="JBSWY3DPEHPK3PXP" className="pl-10 bg-black/30 border-white/5 text-white font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-400">Tempo Plataforma</label>
                      <Select value={formData.tempoPlataforma} onValueChange={v => setFormData({ ...formData, tempoPlataforma: v })}>
                        <SelectTrigger className="bg-black/30 border-white/5 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-1-mes">Novo (0-1 mês)</SelectItem>
                          <SelectItem value="3-meses">3 meses</SelectItem>
                          <SelectItem value="6-meses">6 meses</SelectItem>
                          <SelectItem value="1-ano">1 ano+</SelectItem>
                          <SelectItem value="2-anos">2 anos+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-400">Status Atual</label>
                      <Select value={formData.statusAtual} onValueChange={v => setFormData({ ...formData, statusAtual: v })}>
                        <SelectTrigger className="bg-black/30 border-white/5 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="antigo">Antigo</SelectItem>
                          <SelectItem value="aquecido">Aquecido</SelectItem>
                          <SelectItem value="verificado">Verificado</SelectItem>
                          <SelectItem value="restrito">Restrito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cookies & Descrição */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Cookie className="h-3 w-3" />Cookies JSON/Netscape</label>
                  <Textarea value={formData.cookies} onChange={e => setFormData({ ...formData, cookies: e.target.value })} placeholder='[{"domain": ".facebook.com", ...}]' className="h-28 bg-black/30 border-white/5 text-zinc-300 font-mono text-xs resize-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><FileText className="h-3 w-3" />Descrição</label>
                  <Textarea value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} placeholder="Notas sobre aquecimento, proxy..." className="h-28 bg-black/30 border-white/5 text-white resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400 hover:text-white">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
