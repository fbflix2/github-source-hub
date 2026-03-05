import { useState, useEffect, useMemo } from "react";
import { ImageIcon } from "lucide-react";
import { 
  Building2, CircleUser, PackageOpen, FolderOpen, FolderPlus, Pencil,
  ChevronRight, ChevronDown, Shield, ArrowLeft, Link, FileText, Info,
  AlertTriangle, Save, Copy, Hash, Mail, AtSign, KeyRound, Clock,
  BadgeCheck, Cookie, Eye, EyeOff, Plus, X, Loader2, Trash2, DollarSign, Tag, Flag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditStockItemModal } from "@/components/admin/EditStockItemModal";

interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

interface StockItem {
  id: string;
  name: string;
  type: string;
  identification: string | null;
  identification_link: string | null;
  status: string;
  data: any;
  folder: string | null;
  created_at: string;
}

const itemTypes = [
  { id: "bm", icon: Building2, title: "BM", subtitle: "BUSINESS MANAGER" },
  { id: "perfil", icon: CircleUser, title: "Perfil", subtitle: "CONTAS DE USUÁRIO" },
  { id: "pagina", icon: Flag, title: "Página", subtitle: "PÁGINAS DO FACEBOOK" },
  { id: "combo", icon: PackageOpen, title: "Combo ou Kit", subtitle: "PACOTE DE PRODUTOS" },
];

// ─── Perfil Form ───
function PerfilForm({ folder, onBack, onSaved }: { folder: Folder; onBack: () => void; onSaved: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productDefaults, setProductDefaults] = useState<{ id: string; name: string; tags: string[] }[]>([]);
  const [productImages, setProductImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [formData, setFormData] = useState({
    linkPerfil: "", idPerfil: "", emailAcesso: "", emailAlternativo: "",
    senha: "", senhaEmail: "", token2fa: "", tempoPlataforma: "3-meses", statusAtual: "aquecido",
    cookies: "", descricao: "", nomePerfil: "", dataNascimento: "", genero: "masculino",
    linkDocumento: "", fotoUrl: "", preco: "", categoryId: "", tags: [] as string[], nomeProduto: ""
  });

  useEffect(() => {
    supabase.from("product_categories").select("id, name").then(({ data }) => setCategories(data ?? []));
    supabase.from("product_images").select("id, name, url").eq("category", "perfil").order("created_at", { ascending: false }).then(({ data }) => setProductImages(data ?? []));
    supabase.from("product_defaults").select("id, name, tags, price, tempo_plataforma, description, default_image").order("name").then(({ data }) => setProductDefaults((data as any) ?? []));
  }, []);

  const handleSave = async () => {
    if (!formData.linkPerfil && !formData.idPerfil) {
      toast.error("Preencha ao menos o link ou ID do perfil");
      return;
    }
    setSaving(true);
    const insertData: any = {
      name: formData.nomePerfil || formData.emailAcesso || `Perfil ${formData.idPerfil}`,
      type: "perfil",
      identification: formData.idPerfil || null,
      identification_link: formData.linkPerfil || null,
      status: "aguardando",
      folder: folder.id,
      data: {
        nomePerfil: formData.nomePerfil,
        dataNascimento: formData.dataNascimento,
        genero: formData.genero,
        linkDocumento: formData.linkDocumento,
        senhaEmail: formData.senhaEmail,
        emailAcesso: formData.emailAcesso,
        emailAlternativo: formData.emailAlternativo,
        senha: formData.senha,
        token2fa: formData.token2fa,
        tempoPlataforma: formData.tempoPlataforma,
        statusAtual: formData.statusAtual,
        cookies: formData.cookies,
        descricao: formData.descricao,
        foto_url: formData.fotoUrl || undefined,
        preco: formData.preco ? parseFloat(formData.preco) : undefined,
        categoryId: formData.categoryId || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        nomeProduto: formData.nomeProduto || undefined,
      },
    };
    if (formData.categoryId) insertData.product_id = null; // keep clean
    const { error } = await supabase.from("stock_items").insert(insertData);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Perfil adicionado à pasta! Formulário pronto para novo cadastro.");
    setFormData({
      linkPerfil: "", idPerfil: "", emailAcesso: "", emailAlternativo: "",
      senha: "", senhaEmail: "", token2fa: "", tempoPlataforma: "3-meses", statusAtual: "aquecido",
      cookies: "", descricao: "", nomePerfil: "", dataNascimento: "", genero: "masculino",
      linkDocumento: "", fotoUrl: "", preco: "", categoryId: "", tags: [] as string[], nomeProduto: ""
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Blocagem de Perfil</h1>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <FolderOpen className="h-3 w-3" />
            <span>Pasta: {folder.name}</span>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4 md:p-5">
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left - Identificação */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <BadgeCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-white">Identificação</h2>
              </div>
              {[
                { label: "Nome do Perfil", icon: CircleUser, key: "nomePerfil", placeholder: "Nome completo do perfil", type: "text" },
              ].map(f => (
                <div key={f.key} className="flex flex-col gap-1 group">
                  <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">{f.label}</label>
                  <div className="relative">
                    <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input type={f.type} placeholder={f.placeholder} value={(formData as any)[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600" />
                  </div>
                </div>
              ))}
              {/* Link do Perfil with auto-extract ID */}
              <div className="flex flex-col gap-1 group">
                <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">Link do Perfil</label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input type="url" placeholder="https://facebook.com/profile.php?id=..." value={formData.linkPerfil} onChange={e => {
                    const url = e.target.value;
                    setFormData(prev => {
                      const next = { ...prev, linkPerfil: url };
                      // Auto-extract ID from URL
                      const idMatch = url.match(/[?&]id=(\d+)/i);
                      if (idMatch?.[1]) {
                        next.idPerfil = idMatch[1];
                      } else {
                        const handleMatch = url.match(/facebook\.com\/([^/?#]+)/i);
                        const handle = handleMatch?.[1];
                        const blocked = ["profile.php","people","pages","watch","reel","marketplace","groups","login","settings","help","photo","photo.php","photos"];
                        if (handle && !blocked.includes(handle.toLowerCase())) {
                          next.idPerfil = handle;
                        }
                      }
                      return next;
                    });
                  }} className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600" />
                </div>
              </div>
              <div className="flex flex-col gap-1 group">
                <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">ID do Perfil</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input type="text" placeholder="10000843..." value={formData.idPerfil} onChange={e => setFormData({ ...formData, idPerfil: e.target.value })} className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 font-mono" readOnly />
                </div>
              </div>
              {[
                { label: "E-mail", icon: Mail, key: "emailAcesso", placeholder: "exemplo@fbflix.com", type: "email" },
              ].map(f => (
                <div key={f.key} className="flex flex-col gap-1 group">
                  <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">{f.label}</label>
                  <div className="relative">
                    <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input type={f.type} placeholder={f.placeholder} value={(formData as any)[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} className={`pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600`} />
                  </div>
                </div>
              ))}
              <div className="flex flex-col gap-1 group">
                <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">Senha Email</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input type="text" placeholder="Senha do email" value={formData.senhaEmail} onChange={e => setFormData({ ...formData, senhaEmail: e.target.value })} className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600" />
                </div>
              </div>
              {[
                { label: "Email Alternativo", icon: AtSign, key: "emailAlternativo", placeholder: "recuperacao@email.com", type: "email" },
              ].map(f => (
                <div key={f.key} className="flex flex-col gap-1 group">
                  <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">{f.label}</label>
                  <div className="relative">
                    <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input type={f.type} placeholder={f.placeholder} value={(formData as any)[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} className={`pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600`} />
                  </div>
                </div>
              ))}
              {/* Data de Nascimento & Gênero */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 group">
                  <label className="text-xs font-medium text-zinc-400">Data de Nascimento</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input type="date" value={formData.dataNascimento} onChange={e => setFormData({ ...formData, dataNascimento: e.target.value })} className="pl-10 bg-black/30 border-white/5 text-white" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400">Gênero</label>
                  <Select value={formData.genero} onValueChange={v => setFormData({ ...formData, genero: v })}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1 group">
                <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                  Link do Documento <span className="text-zinc-600">(opcional)</span>
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input type="url" placeholder="https://drive.google.com/..." value={formData.linkDocumento} onChange={e => setFormData({ ...formData, linkDocumento: e.target.value })} className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600" />
                </div>
              </div>
            </div>

            {/* Right - Segurança */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-white">Segurança & Status</h2>
              </div>
              <div className="flex flex-col gap-1 group">
                <label className="text-xs font-medium text-zinc-400">Senha FB</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input type="text" placeholder="Cole a senha aqui" value={formData.senha} onChange={e => setFormData({ ...formData, senha: e.target.value })} className="pl-10 pr-10 bg-black/30 border-white/5 text-white" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                    {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1 group">
                <label className="text-xs font-medium text-zinc-400">Token 2FA</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input type="text" placeholder="JBSWY3DPEHPK3PXP" value={formData.token2fa} onChange={e => setFormData({ ...formData, token2fa: e.target.value })} className="pl-10 bg-black/30 border-white/5 text-white font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400">Tempo Plataforma</label>
                  <Select value={formData.tempoPlataforma} onValueChange={v => setFormData({ ...formData, tempoPlataforma: v })}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1-mes">0-1 mês</SelectItem>
                      <SelectItem value="3-meses">3 meses</SelectItem>
                      <SelectItem value="6-meses">6 meses</SelectItem>
                      <SelectItem value="1-ano">1 ano+</SelectItem>
                      <SelectItem value="2-anos">2 anos+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400">Status Atual</label>
                  <Select value={formData.statusAtual} onValueChange={v => setFormData({ ...formData, statusAtual: v })}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="antigo">Antigo</SelectItem>
                      <SelectItem value="aquecido">Aquecido</SelectItem>
                      <SelectItem value="verificado">Verificado</SelectItem>
                      <SelectItem value="restrito">Restrito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400">Nome do Produto</label>
                  <Select value={formData.nomeProduto} onValueChange={v => {
                    const def = productDefaults.find(d => d.name === v);
                    setFormData({
                      ...formData,
                      nomeProduto: v,
                      tags: def?.tags ?? [],
                      preco: (def as any)?.price ? String((def as any).price) : formData.preco,
                      tempoPlataforma: (def as any)?.tempo_plataforma || formData.tempoPlataforma,
                      descricao: (def as any)?.description || formData.descricao,
                      fotoUrl: (def as any)?.default_image || formData.fotoUrl,
                    });
                  }}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {productDefaults.filter(d => !d.name.toLowerCase().includes('proxy')).map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Product fields inline */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><DollarSign className="h-3 w-3" />Preço (R$)</label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.preco} onChange={e => setFormData({ ...formData, preco: e.target.value })} className="bg-black/30 border-white/5 text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><FolderOpen className="h-3 w-3" />Categoria</label>
                  <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v })}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Tag className="h-3 w-3" />Tags (do padrão)</label>
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map(tag => (
                      <Badge key={tag} className="bg-primary/20 text-primary text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Product Image Picker */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><ImageIcon className="h-3 w-3" />Foto do Produto</label>
                {formData.fotoUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={formData.fotoUrl} alt="Produto" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-zinc-400" onClick={() => setFormData({ ...formData, fotoUrl: "" })}>
                      <X className="h-3 w-3 mr-1" /> Remover
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="w-full bg-black/30 border-white/5 text-zinc-400 hover:text-white" onClick={() => setShowImagePicker(true)}>
                    <ImageIcon className="h-3.5 w-3.5 mr-2" /> Selecionar imagem
                  </Button>
                )}
                {showImagePicker && (
                  <div className="mt-2 p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Imagens cadastradas</span>
                      <button type="button" onClick={() => setShowImagePicker(false)} className="text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    {productImages.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-4">Nenhuma imagem cadastrada. Vá em Plataforma → Imagens para adicionar.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                        {productImages.map(img => (
                          <button key={img.id} type="button" onClick={() => { setFormData({ ...formData, fotoUrl: img.url }); setShowImagePicker(false); }} className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-primary/50 transition-all">
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 flex items-start gap-2 mt-auto">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-primary/80 leading-relaxed">
                  Certifique-se de que o 2FA está ativo antes de salvar perfis "Aquecidos" ou "Verificados".
                </p>
              </div>
            </div>
          </div>

          {/* Bottom - Cookies & Description */}
          <div className="flex flex-col md:flex-row gap-4 pt-3 border-t border-white/5">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Cookie className="h-3 w-3" />Cookies JSON/Netscape</label>
              <Textarea placeholder='[{"domain": ".facebook.com", ...}]' value={formData.cookies} onChange={e => setFormData({ ...formData, cookies: e.target.value })} className="h-20 bg-black/30 border-white/5 text-zinc-300 font-mono text-xs resize-none" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><FileText className="h-3 w-3" />Descrição</label>
              <Textarea placeholder="Notas sobre aquecimento, proxy..." value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} className="h-20 bg-black/30 border-white/5 text-white resize-none" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white hover:bg-white/5">Voltar</Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Adicionar à Pasta
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página Form ───
function PaginaForm({ folder, onBack, onSaved }: { folder: Folder; onBack: () => void; onSaved: () => void }) {
  const [nomes, setNomes] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productDefaults, setProductDefaults] = useState<any[]>([]);
  const [productImages, setProductImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [formData, setFormData] = useState({
    descricao: "", preco: "", categoryId: "", tags: [] as string[], nomeProduto: "", fotoUrl: "",
  });

  useEffect(() => {
    supabase.from("product_categories").select("id, name").then(({ data }) => setCategories(data ?? []));
    supabase.from("product_images").select("id, name, url").eq("category", "pagina").order("created_at", { ascending: false }).then(({ data }) => setProductImages(data ?? []));
    supabase.from("product_defaults").select("id, name, tags, price, default_image, description").order("name").then(({ data }) => setProductDefaults(data ?? []));
  }, []);

  const lines = useMemo(() => {
    return nomes.split("\n").filter(l => l.trim());
  }, [nomes]);

  const handleSave = async () => {
    if (lines.length === 0) { toast.error("Adicione ao menos um nome de página"); return; }
    setSaving(true);
    const items = lines.map((nome) => ({
      name: nome.trim(),
      type: "pagina",
      status: "aguardando",
      folder: folder.id,
      data: {
        nomePagina: nome.trim(),
        descricao: formData.descricao || undefined,
        preco: formData.preco ? parseFloat(formData.preco) : undefined,
        categoryId: formData.categoryId || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        foto_url: formData.fotoUrl || undefined,
        nomeProduto: formData.nomeProduto || undefined,
      },
    }));
    const { error } = await supabase.from("stock_items").insert(items);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${lines.length} página(s) adicionada(s)! Formulário pronto para novo cadastro.`);
    setNomes("");
    setFormData({ descricao: "", preco: "", categoryId: "", tags: [], nomeProduto: "", fotoUrl: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />Voltar
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-primary font-medium">Blocagem de Página</span>
      </div>

      <div className="glass-panel rounded-xl p-4 md:p-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-4">
          <Flag className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white">Nova Página</h2>
          <span className="ml-auto text-xs text-zinc-500">Pasta: {folder.name}</span>
        </div>

        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          {/* Nomes das Páginas - múltiplas linhas */}
          <div className="flex flex-col gap-1 group">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400 group-focus-within:text-white transition-colors">Nome do Produto</label>
              <span className="text-[10px] text-zinc-500">{lines.length} página(s)</span>
            </div>
            <Textarea
              placeholder={"Digite um nome por linha:\nPágina Premium 1\nPágina Premium 2\nPágina Premium 3"}
              value={nomes}
              onChange={e => setNomes(e.target.value)}
              className="h-28 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 resize-none"
              autoFocus
            />
          </div>

          {/* Product config */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Nome do Produto</label>
              <Select value={formData.nomeProduto} onValueChange={v => {
                const def = productDefaults.find((d: any) => d.name === v);
                setFormData({
                  ...formData,
                  nomeProduto: v,
                  tags: def?.tags ?? [],
                  preco: def?.price ? String(def.price) : formData.preco,
                  descricao: def?.description || formData.descricao,
                  fotoUrl: def?.default_image || formData.fotoUrl,
                });
              }}>
                <SelectTrigger className="bg-black/30 border-white/5 text-white text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {productDefaults.filter((d: any) => !d.name.toLowerCase().includes('proxy')).map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><DollarSign className="h-3 w-3" />Preço (R$)</label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.preco} onChange={e => setFormData({ ...formData, preco: e.target.value })} className="bg-black/30 border-white/5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><FolderOpen className="h-3 w-3" />Categoria</label>
              <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v })}>
                <SelectTrigger className="bg-black/30 border-white/5 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.tags.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Tag className="h-3 w-3" />Tags</label>
              <div className="flex flex-wrap gap-1">
                {formData.tags.map(tag => (
                  <Badge key={tag} className="bg-primary/20 text-primary text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Image Picker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><ImageIcon className="h-3 w-3" />Foto do Produto</label>
            {formData.fotoUrl ? (
              <div className="flex items-center gap-2">
                <img src={formData.fotoUrl} alt="Produto" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                <Button type="button" variant="ghost" size="sm" className="text-xs text-zinc-400" onClick={() => setFormData({ ...formData, fotoUrl: "" })}>
                  <X className="h-3 w-3 mr-1" /> Remover
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-full bg-black/30 border-white/5 text-zinc-400 hover:text-white" onClick={() => setShowImagePicker(true)}>
                <ImageIcon className="h-3.5 w-3.5 mr-2" /> Selecionar imagem
              </Button>
            )}
            {showImagePicker && (
              <div className="mt-2 p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Imagens cadastradas</span>
                  <button type="button" onClick={() => setShowImagePicker(false)} className="text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
                {productImages.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Nenhuma imagem cadastrada para páginas.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                    {productImages.map(img => (
                      <button key={img.id} type="button" onClick={() => { setFormData({ ...formData, fotoUrl: img.url }); setShowImagePicker(false); }} className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-primary/50 transition-all">
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><FileText className="h-3 w-3" />Descrição</label>
            <Textarea placeholder="Notas sobre a página..." value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} className="h-20 bg-black/30 border-white/5 text-white resize-none" />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white hover:bg-white/5">Voltar</Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Adicionar à Pasta
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── BM Form ───
function BMForm({ folder, onBack, onSaved }: { folder: Folder; onBack: () => void; onSaved: () => void }) {
  const [urls, setUrls] = useState("");
  const [descricao, setDescricao] = useState("");
  const [perfilBackup, setPerfilBackup] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [preco, setPreco] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [nomeProduto, setNomeProduto] = useState("");
  const [productDefaults, setProductDefaults] = useState<{ id: string; name: string; tags: string[] }[]>([]);
  const [productImages, setProductImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");

  useEffect(() => {
    supabase.from("product_categories").select("id, name").then(({ data }) => setCategories(data ?? []));
    supabase.from("product_images").select("id, name, url").eq("category", "bm").order("created_at", { ascending: false }).then(({ data }) => setProductImages(data ?? []));
    supabase.from("product_defaults").select("id, name, tags, price, default_image, description").order("name").then(({ data }) => setProductDefaults((data as any) ?? []));
  }, []);

  const urlLines = useMemo(() => {
    const lines = urls.split("\n").filter(l => l.trim());
    // Remove duplicates keeping first occurrence
    const seen = new Set<string>();
    return lines.filter(l => {
      const normalized = l.trim().toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [urls]);

  const handleUrlsChange = (value: string) => {
    const lines = value.split("\n");
    const seen = new Set<string>();
    const deduped: string[] = [];
    let removedCount = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { deduped.push(line); continue; }
      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) { removedCount++; continue; }
      seen.add(normalized);
      deduped.push(line);
    }
    setUrls(deduped.join("\n"));
    if (removedCount > 0) {
      toast.warning(`${removedCount} URL(s) duplicada(s) removida(s)`);
    }
  };

  const handleSave = async () => {
    if (urlLines.length === 0) { toast.error("Adicione ao menos uma URL"); return; }
    setSaving(true);
    const items = urlLines.map((url, i) => ({
      name: `BM #${i + 1}`,
      type: "bm",
      identification_link: url.trim(),
      status: "aguardando",
      folder: folder.id,
      data: {
        descricao: descricao || undefined,
        perfilBackup: perfilBackup || undefined,
        preco: preco ? parseFloat(preco) : undefined,
        categoryId: categoryId || undefined,
        tags: tags.length > 0 ? tags : undefined,
        foto_url: selectedImageUrl || undefined,
        nomeProduto: nomeProduto || undefined,
      },
    }));
    const { error } = await supabase.from("stock_items").insert(items);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${urlLines.length} BM(s) adicionados! Formulário pronto para novo cadastro.`);
    setUrls("");
    setDescricao("");
    setPerfilBackup("");
    setPreco("");
    setCategoryId("");
    setTags([]);
    setNomeProduto("");
    setSelectedImageUrl("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />Voltar
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-primary font-medium">Nova Blocagem</span>
      </div>

      <div className="glass-panel rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Cadastro de BM</h1>
              <p className="text-zinc-400">Pasta: <span className="text-white font-medium">{folder.name}</span></p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-300">
                <Link className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium">URLs dos BMs (um por linha)</span>
              </div>
              <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">Aceita múltiplas linhas</Badge>
            </div>
            <Textarea value={urls} onChange={e => handleUrlsChange(e.target.value)} placeholder="https://business.facebook.com/overview..." className="min-h-[280px] bg-zinc-900/50 border-zinc-700 text-white font-mono text-sm resize-none" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Pressione Enter para nova linha.</span>
              <span className="text-primary font-medium">Total: {urlLines.length}</span>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-3 pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><DollarSign className="h-3 w-3" />Preço (R$)</label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={preco} onChange={e => setPreco(e.target.value)} className="bg-zinc-900/50 border-zinc-700 text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><FolderOpen className="h-3 w-3" />Categoria</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><PackageOpen className="h-3 w-3" />Nome do Produto</label>
              <Select value={nomeProduto} onValueChange={v => {
                  const def = productDefaults.find(d => d.name === v) as any;
                  setNomeProduto(v);
                  setTags(def?.tags ?? []);
                  if (def?.price) setPreco(String(def.price));
                  if (def?.default_image) setSelectedImageUrl(def.default_image);
                  if (def?.description) setDescricao(def.description);
                }}>
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {productDefaults.filter(d => !d.name.toLowerCase().includes('proxy')).map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Tag className="h-3 w-3" />Tags (do padrão)</label>
                  <div className="flex flex-wrap gap-1">
                    {tags.map(tag => (
                      <Badge key={tag} className="bg-primary/20 text-primary text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Product Image Picker */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><ImageIcon className="h-3 w-3" />Foto do Produto</label>
                {selectedImageUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={selectedImageUrl} alt="Produto" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-zinc-400" onClick={() => setSelectedImageUrl("")}>
                      <X className="h-3 w-3 mr-1" /> Remover
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="w-full bg-zinc-900/50 border-zinc-700 text-zinc-400 hover:text-white" onClick={() => setShowImagePicker(true)}>
                    <ImageIcon className="h-3.5 w-3.5 mr-2" /> Selecionar imagem
                  </Button>
                )}
                {showImagePicker && (
                  <div className="mt-2 p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Imagens cadastradas</span>
                      <button type="button" onClick={() => setShowImagePicker(false)} className="text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    {productImages.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-4">Nenhuma imagem cadastrada. Vá em Plataforma → Imagens para adicionar.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                        {productImages.map(img => (
                          <button key={img.id} type="button" onClick={() => { setSelectedImageUrl(img.url); setShowImagePicker(false); }} className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-primary/50 transition-all">
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-2"><FileText className="h-3 w-3" />Descrição</label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do item..." className="min-h-[80px] bg-zinc-900/50 border-zinc-700 text-white resize-none" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-white gap-2 h-12">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar BMs na Pasta
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Folder Items View ───
function FolderItemsView({ folder, onBack }: { folder: Folder; onBack: () => void }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from("stock_items").select("*").eq("folder", folder.id).neq("status", "revisado").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [folder.id]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Item excluído");
    fetchItems();
  };

  const statusStyles: Record<string, string> = {
    aguardando: "bg-yellow-500/20 text-yellow-400",
    revisado: "bg-green-500/20 text-green-400",
    erro: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{folder.name}</h1>
          <p className="text-sm text-zinc-400">{items.length} itens nesta pasta</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-8 text-primary animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <FolderOpen className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">Pasta vazia. Adicione itens usando os botões de tipo acima.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl divide-y divide-white/5">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.type === "bm" ? "bg-primary/20 text-primary" : item.type === "perfil" ? "bg-cyan-500/20 text-cyan-400" : "bg-purple-500/20 text-purple-400"}`}>
                  {item.type === "bm" ? <Building2 className="h-4 w-4" /> : item.type === "perfil" ? <CircleUser className="h-4 w-4" /> : <PackageOpen className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{item.name}</p>
                  <p className="text-xs text-zinc-500">{item.identification_link || item.identification || "Sem identificação"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={`text-xs ${statusStyles[item.status] || statusStyles.aguardando}`}>{item.status}</Badge>
                <span className="text-xs text-zinc-500">{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                <button onClick={() => setEditingItem(item)} className="text-zinc-500 hover:text-white transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditStockItemModal
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        onSaved={fetchItems}
      />
    </div>
  );
}

// ─── Main Component ───
export default function AdminBlocagem() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [viewingFolder, setViewingFolder] = useState<Folder | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [trashedFolders, setTrashedFolders] = useState<(Folder & { deleted_at: string })[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [trashedItems, setTrashedItems] = useState<Record<string, StockItem[]>>({});

  const fetchFolders = async () => {
    const { data: foldersData } = await supabase.from("stock_folders").select("*").is("deleted_at", null).order("updated_at", { ascending: false });
    if (!foldersData) { setLoading(false); return; }
    // Count items per folder
    const { data: itemsData } = await supabase.from("stock_items").select("folder").is("deleted_at", null).neq("status", "revisado");
    const counts: Record<string, number> = {};
    (itemsData ?? []).forEach(i => { if (i.folder) counts[i.folder] = (counts[i.folder] || 0) + 1; });
    setFolders(foldersData.map(f => ({ ...f, item_count: counts[f.id] || 0 })));
    setLoading(false);
  };

  const fetchTrash = async () => {
    setLoadingTrash(true);
    const { data } = await supabase.from("stock_folders").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
    const trashed = (data ?? []) as (Folder & { deleted_at: string })[];
    setTrashedFolders(trashed);
    // Fetch items for each trashed folder
    if (trashed.length > 0) {
      const folderIds = trashed.map(f => f.id);
      const { data: items } = await supabase.from("stock_items").select("*").in("folder", folderIds);
      const grouped: Record<string, StockItem[]> = {};
      (items ?? []).forEach(item => {
        if (item.folder) {
          if (!grouped[item.folder]) grouped[item.folder] = [];
          grouped[item.folder].push(item as StockItem);
        }
      });
      setTrashedItems(grouped);
    }
    setLoadingTrash(false);
  };

  useEffect(() => { fetchFolders(); }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { toast.error("Digite um nome para a pasta"); return; }
    const { error } = await supabase.from("stock_folders").insert({ name: newFolderName.trim() });
    if (error) { toast.error("Erro: " + error.message); return; }
    setNewFolderName("");
    setIsCreateFolderOpen(false);
    toast.success("Pasta criada!");
    fetchFolders();
  };

  const handleRenameFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;
    const { error } = await supabase.from("stock_folders").update({ name: newFolderName.trim() }).eq("id", editingFolder.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setEditingFolder(null);
    setNewFolderName("");
    toast.success("Pasta renomeada!");
    fetchFolders();
  };

  const handleSoftDeleteFolder = async (folder: Folder) => {
    const now = new Date().toISOString();
    // Soft delete folder
    await supabase.from("stock_folders").update({ deleted_at: now } as any).eq("id", folder.id);
    // Soft delete its items
    await supabase.from("stock_items").update({ deleted_at: now } as any).eq("folder", folder.id);
    if (selectedFolder?.id === folder.id) setSelectedFolder(null);
    toast.success("Pasta movida para a lixeira");
    fetchFolders();
  };

  const handleRestoreFolder = async (folder: Folder & { deleted_at: string }) => {
    await supabase.from("stock_folders").update({ deleted_at: null } as any).eq("id", folder.id);
    await supabase.from("stock_items").update({ deleted_at: null } as any).eq("folder", folder.id);
    toast.success("Pasta restaurada!");
    fetchTrash();
    fetchFolders();
  };

  const handlePermanentDeleteFolder = async (folder: Folder) => {
    // Delete items first, then folder
    await supabase.from("stock_items").delete().eq("folder", folder.id);
    await supabase.from("stock_folders").delete().eq("id", folder.id);
    toast.success("Pasta excluída permanentemente");
    fetchTrash();
  };

  const handleSelectTypeAndFolder = (type: string) => {
    if (!selectedFolder) {
      toast.error("Selecione uma pasta primeiro");
      return;
    }
    setSelectedType(type);
  };

  // Show folder items view
  if (viewingFolder) {
    return (
      <div className="py-6">
        <FolderItemsView folder={viewingFolder} onBack={() => { setViewingFolder(null); fetchFolders(); }} />
      </div>
    );
  }

  // Show BM form
  if (selectedType === "bm" && selectedFolder) {
    return (
      <div className="py-6">
        <BMForm folder={selectedFolder} onBack={() => setSelectedType(null)} onSaved={() => { setSelectedType(null); fetchFolders(); }} />
      </div>
    );
  }

  // Show Perfil form
  if (selectedType === "perfil" && selectedFolder) {
    return (
      <div className="py-6">
        <PerfilForm folder={selectedFolder} onBack={() => setSelectedType(null)} onSaved={() => { setSelectedType(null); fetchFolders(); }} />
      </div>
    );
  }

  // Show Página form
  if (selectedType === "pagina" && selectedFolder) {
    return (
      <div className="py-6">
        <PaginaForm folder={selectedFolder} onBack={() => setSelectedType(null)} onSaved={() => { setSelectedType(null); fetchFolders(); }} />
      </div>
    );
  }

  const formatUpdatedAt = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Atualizado agora";
    if (diffMins < 60) return `Atualizado há ${diffMins}min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Atualizado há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Atualizado ontem";
    return `Atualizado há ${diffDays} dias`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="text-center py-4 space-y-2 flex-shrink-0">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-white">Nova Blocagem de Itens</h1>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto">
          Selecione uma pasta e o tipo de item para iniciar uma nova blocagem.
        </p>
      </div>

      {/* Item Type Selection */}
      <div className="flex justify-center gap-6 py-4 flex-shrink-0">
        {itemTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => handleSelectTypeAndFolder(type.id)}
            className="group flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300 bg-transparent border border-transparent hover:bg-white/[0.03] hover:border-white/10"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-zinc-800/80 group-hover:bg-zinc-700/80 transition-colors">
              <type.icon className="h-6 w-6 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-zinc-300">{type.title}</h3>
              <p className="text-[10px] text-zinc-500 tracking-wider mt-0.5">{type.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Folder Management */}
      <div className="glass-panel rounded-xl p-4 flex-1 min-h-0 flex flex-col max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-white">Gerenciar Pastas de Estoque</h2>
              <p className="text-xs text-zinc-500">Selecione uma pasta para trabalhar.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setShowTrash(!showTrash); if (!showTrash) fetchTrash(); }} className={`gap-1.5 text-xs h-8 ${showTrash ? 'text-red-400 bg-red-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
              <Trash2 className="h-3.5 w-3.5" />
              Lixeira
            </Button>
            <Button size="sm" onClick={() => { setIsCreateFolderOpen(true); setNewFolderName(""); }} className="bg-primary hover:bg-primary/90 text-white gap-1.5 text-xs h-8">
              <FolderPlus className="h-3.5 w-3.5" />
              Criar Nova Pasta
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 max-h-[calc(100vh-380px)]">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-6 text-primary animate-spin" /></div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Nenhuma pasta criada ainda.</div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(selectedFolder?.id === folder.id ? null : folder)}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer group ${
                  selectedFolder?.id === folder.id ? "bg-primary/10 border border-primary/30" : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedFolder?.id === folder.id ? "bg-primary/20" : "bg-primary/10"}`}>
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm text-white font-medium">{folder.name}</h3>
                    <p className="text-xs text-zinc-500">{folder.item_count ?? 0} itens • {formatUpdatedAt(folder.updated_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); setEditingFolder(folder); setNewFolderName(folder.name); }} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleSoftDeleteFolder(folder); }} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setViewingFolder(folder); }} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Trash Section */}
        {showTrash && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Lixeira</h3>
            </div>
            {loadingTrash ? (
              <div className="flex justify-center py-4"><Loader2 className="size-5 text-primary animate-spin" /></div>
            ) : trashedFolders.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3 text-center">Lixeira vazia.</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {trashedFolders.map(folder => (
                  <div key={folder.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <FolderOpen className="h-3.5 w-3.5 text-red-400" />
                      </div>
                      <div>
                        <h4 className="text-sm text-zinc-300 font-medium">{folder.name}</h4>
                        <p className="text-[10px] text-zinc-500">
                          {(trashedItems[folder.id] ?? []).length} itens • Excluída {formatUpdatedAt(folder.deleted_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleRestoreFolder(folder)} className="h-7 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10 gap-1">
                        <ArrowLeft className="h-3 w-3" /> Restaurar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handlePermanentDeleteFolder(folder)} className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1">
                        <X className="h-3 w-3" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Criar Nova Pasta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Ex: BMs Premium, Perfis Aquecidos..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateFolder()} className="bg-black/30 border-white/10 text-white placeholder:text-zinc-600" autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsCreateFolderOpen(false)} className="text-zinc-400 hover:text-white hover:bg-white/5">Cancelar</Button>
              <Button onClick={handleCreateFolder} className="bg-primary hover:bg-primary/90 text-white gap-1.5">
                <FolderPlus className="h-4 w-4" />Criar Pasta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={open => { if (!open) setEditingFolder(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Renomear Pasta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRenameFolder()} className="bg-black/30 border-white/10 text-white" autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingFolder(null)} className="text-zinc-400 hover:text-white hover:bg-white/5">Cancelar</Button>
              <Button onClick={handleRenameFolder} className="bg-primary hover:bg-primary/90 text-white gap-1.5">
                <Save className="h-4 w-4" />Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
