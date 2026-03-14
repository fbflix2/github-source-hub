import { useState, useEffect } from "react";
import { ImageIcon } from "lucide-react";
import {
  Building2, CircleUser, PackageOpen, FolderOpen, ArrowLeft, Link, FileText, Info,
  Shield, Save, Hash, Mail, AtSign, KeyRound, Clock, BadgeCheck, Cookie, Eye, EyeOff,
  Plus, X, Loader2, Trash2, DollarSign, Tag, ChevronDown, ChevronUp, Package
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Folder { id: string; name: string; }

interface ProfileData {
  nomePerfil: string; linkPerfil: string; idPerfil: string;
  emailAcesso: string; emailAlternativo: string; senha: string;
  senhaEmail: string; token2fa: string; tempoPlataforma: string;
  statusAtual: string; cookies: string; descricao: string;
  dataNascimento: string; genero: string; linkDocumento: string;
}

interface ComboData {
  nomeCombo: string; preco: string; categoryId: string;
  nomeProduto: string; fotoUrl: string; tags: string[];
  descricaoCombo: string;
  profiles: ProfileData[];
}

const emptyProfile = (): ProfileData => ({
  nomePerfil: "", linkPerfil: "", idPerfil: "",
  emailAcesso: "", emailAlternativo: "", senha: "",
  senhaEmail: "", token2fa: "", tempoPlataforma: "3-meses",
  statusAtual: "aquecido", cookies: "", descricao: "",
  dataNascimento: "", genero: "masculino", linkDocumento: "",
});

const emptyCombo = (): ComboData => ({
  nomeCombo: "", preco: "", categoryId: "",
  nomeProduto: "", fotoUrl: "", tags: [],
  descricaoCombo: "",
  profiles: [emptyProfile(), emptyProfile(), emptyProfile()],
});

const COMBO_DRAFT_KEY = "combo_form_draft_v2";

export default function ComboForm({ folder, onBack, onSaved }: { folder: Folder; onBack: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productDefaults, setProductDefaults] = useState<any[]>([]);
  const [productImages, setProductImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [expandedProfiles, setExpandedProfiles] = useState<number[]>([0]);

  const [formData, setFormData] = useState<ComboData>(() => {
    try {
      const saved = localStorage.getItem(COMBO_DRAFT_KEY);
      if (saved) return { ...emptyCombo(), ...JSON.parse(saved) };
    } catch {}
    return emptyCombo();
  });

  useEffect(() => { setHasDraft(!!localStorage.getItem(COMBO_DRAFT_KEY)); }, []);

  useEffect(() => {
    supabase.from("product_categories").select("id, name").then(({ data }) => setCategories(data ?? []));
    supabase.from("product_images").select("id, name, url").eq("category", "perfil").order("created_at", { ascending: false }).then(({ data }) => setProductImages(data ?? []));
    supabase.from("product_defaults").select("id, name, tags, price, tempo_plataforma, description, default_image").order("name").then(({ data }) => setProductDefaults(data ?? []));
  }, []);

  const handleSaveDraft = () => {
    setSavingDraft(true);
    localStorage.setItem(COMBO_DRAFT_KEY, JSON.stringify(formData));
    setHasDraft(true);
    setTimeout(() => setSavingDraft(false), 600);
    toast.success("Rascunho salvo com sucesso!");
  };

  const handleClearDraft = () => {
    localStorage.removeItem(COMBO_DRAFT_KEY);
    setHasDraft(false);
    setFormData(emptyCombo());
    toast.info("Rascunho descartado.");
  };

  const updateProfile = (index: number, updates: Partial<ProfileData>) => {
    setFormData(prev => ({
      ...prev,
      profiles: prev.profiles.map((p, i) => i === index ? { ...p, ...updates } : p),
    }));
  };

  const addProfile = () => {
    setFormData(prev => ({
      ...prev,
      profiles: [...prev.profiles, emptyProfile()],
    }));
    setExpandedProfiles(prev => [...prev, formData.profiles.length]);
  };

  const removeProfile = (index: number) => {
    if (formData.profiles.length <= 1) { toast.error("O combo precisa de pelo menos 1 perfil."); return; }
    setFormData(prev => ({ ...prev, profiles: prev.profiles.filter((_, i) => i !== index) }));
    setExpandedProfiles(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const toggleProfile = (index: number) => {
    setExpandedProfiles(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  const extractIdFromUrl = (url: string): string => {
    const idMatch = url.match(/[?&]id=(\d+)/i);
    if (idMatch?.[1]) return idMatch[1];
    const handleMatch = url.match(/facebook\.com\/([^/?#]+)/i);
    const handle = handleMatch?.[1];
    const blocked = ["profile.php","people","pages","watch","reel","marketplace","groups","login","settings","help","photo","photo.php","photos"];
    if (handle && !blocked.includes(handle.toLowerCase())) return handle;
    return "";
  };

  const handleSave = async () => {
    if (!formData.nomeCombo.trim()) { toast.error("Dê um nome ao combo"); return; }
    const filledProfiles = formData.profiles.filter(p => p.linkPerfil || p.idPerfil || p.emailAcesso);
    if (filledProfiles.length === 0) { toast.error("Adicione pelo menos 1 perfil com dados"); return; }

    setSaving(true);
    try {
      // 1. Create parent combo item
      const comboInsert: any = {
        name: formData.nomeCombo,
        type: "combo",
        status: "aguardando",
        folder: folder.id,
        data: {
          nomeCombo: formData.nomeCombo,
          descricaoCombo: formData.descricaoCombo,
          preco: formData.preco ? parseFloat(formData.preco) : undefined,
          categoryId: formData.categoryId || undefined,
          nomeProduto: formData.nomeProduto || undefined,
          foto_url: formData.fotoUrl || undefined,
          tags: formData.tags.length > 0 ? formData.tags : undefined,
          childCount: filledProfiles.length,
        },
      };

      const { data: parentData, error: parentError } = await supabase
        .from("stock_items")
        .insert(comboInsert)
        .select("id")
        .single();

      if (parentError) throw parentError;
      const parentId = parentData.id;

      // 2. Create child profile items linked to parent
      const childInserts = filledProfiles.map((p, i) => ({
        name: p.nomePerfil || p.emailAcesso || `Perfil ${i + 1} do Combo`,
        type: "perfil",
        identification: p.idPerfil || null,
        identification_link: p.linkPerfil || null,
        status: "aguardando",
        folder: folder.id,
        parent_id: parentId,
        data: {
          nomePerfil: p.nomePerfil,
          dataNascimento: p.dataNascimento,
          genero: p.genero,
          linkDocumento: p.linkDocumento,
          senhaEmail: p.senhaEmail,
          emailAcesso: p.emailAcesso,
          emailAlternativo: p.emailAlternativo,
          senha: p.senha,
          token2fa: p.token2fa,
          tempoPlataforma: p.tempoPlataforma,
          statusAtual: p.statusAtual,
          cookies: p.cookies,
          descricao: p.descricao,
          _comboName: formData.nomeCombo,
          _comboIndex: i + 1,
        },
      }));

      const { error: childError } = await supabase.from("stock_items").insert(childInserts);
      if (childError) throw childError;

      localStorage.removeItem(COMBO_DRAFT_KEY);
      setHasDraft(false);
      toast.success(`Combo "${formData.nomeCombo}" com ${filledProfiles.length} perfis adicionado!`);
      setFormData(emptyCombo());
      onSaved();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Blocagem de Combo</h1>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <FolderOpen className="h-3 w-3" />
              <span>Pasta: {folder.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasDraft && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearDraft} className="text-xs text-zinc-500 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Descartar rascunho
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={handleSaveDraft} disabled={savingDraft} className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1.5">
            {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar como rascunho
          </Button>
        </div>
      </div>

      {/* Combo Info */}
      <div className="glass-panel rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-white/10 mb-3">
          <PackageOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-white">Informações do Combo</h2>
          <Badge className="bg-primary/20 text-primary text-[10px] ml-auto">{formData.profiles.length} perfis</Badge>
        </div>

        {/* Modo Pacote Toggle */}
        <div className={`flex items-center gap-3 p-3 rounded-xl mb-3 transition-all ${formData.isPacote ? "bg-primary/10 border border-primary/30" : "bg-muted/30 border border-border"}`}>
          <Package className={`h-5 w-5 shrink-0 ${formData.isPacote ? "text-primary" : "text-muted-foreground"}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${formData.isPacote ? "text-primary" : "text-foreground"}`}>Modo Pacote</span>
              {formData.isPacote && <Badge className="bg-primary/20 text-primary text-[10px]">Ativo</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {formData.isPacote
                ? "Todos os perfis serão agrupados em um único pacote. O cliente compra por um preço único e recebe todos os itens dentro."
                : "Ative para agrupar os perfis em um pacote único de venda."}
            </p>
          </div>
          <Switch checked={formData.isPacote} onCheckedChange={v => setFormData({ ...formData, isPacote: v })} />
        </div>

        {formData.isPacote && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3">
            <Info className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-300">
              📦 Pacote com {formData.profiles.length} {formData.profiles.length === 1 ? "item" : "itens"} — preço único de R$ {formData.preco || "0,00"}. Na compra, o cliente recebe {formData.profiles.length} {formData.profiles.length === 1 ? "perfil separado" : "perfis separados"}.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Nome do Combo</label>
            <Input placeholder="Ex: Perfil + BM 1,3K" value={formData.nomeCombo} onChange={e => setFormData({ ...formData, nomeCombo: e.target.value })} className="bg-black/30 border-white/5 text-white placeholder:text-zinc-600" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Nome do Produto</label>
            <Select value={formData.nomeProduto} onValueChange={v => {
              const def = productDefaults.find((d: any) => d.name === v);
              setFormData(prev => ({
                ...prev,
                nomeProduto: v,
                tags: def?.tags ?? [],
                preco: def?.price ? String(def.price) : prev.preco,
                descricaoCombo: def?.description || prev.descricaoCombo,
                fotoUrl: def?.default_image || prev.fotoUrl,
              }));
            }}>
              <SelectTrigger className="bg-black/30 border-white/5 text-white text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {productDefaults.filter((d: any) => !d.name.toLowerCase().includes('proxy')).map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 flex items-center gap-1"><DollarSign className="h-3 w-3" />Preço do Combo (R$)</label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.preco} onChange={e => setFormData({ ...formData, preco: e.target.value })} className="bg-black/30 border-white/5 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 flex items-center gap-1"><FolderOpen className="h-3 w-3" />Categoria</label>
            <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v })}>
              <SelectTrigger className="bg-black/30 border-white/5 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 flex items-center gap-1"><ImageIcon className="h-3 w-3" />Foto do Produto</label>
            {formData.fotoUrl ? (
              <div className="flex items-center gap-2">
                <img src={formData.fotoUrl} alt="Produto" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
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
                  <p className="text-xs text-zinc-500 text-center py-4">Nenhuma imagem cadastrada.</p>
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
        </div>

        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {formData.tags.map((tag: string) => <Badge key={tag} className="bg-primary/20 text-primary text-[10px]">{tag}</Badge>)}
          </div>
        )}

        <div className="flex flex-col gap-1 mt-3">
          <label className="text-xs font-medium text-zinc-400 flex items-center gap-1"><FileText className="h-3 w-3" />Descrição do Combo</label>
          <Textarea placeholder="Ex: Combo com 3 perfis aquecidos + BM 1,3K cada..." value={formData.descricaoCombo} onChange={e => setFormData({ ...formData, descricaoCombo: e.target.value })} className="h-16 bg-black/30 border-white/5 text-white resize-none" />
        </div>
      </div>

      {/* Profiles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleUser className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-white">Perfis do Combo</h2>
          </div>
          <Button type="button" size="sm" onClick={addProfile} className="gap-1.5 text-xs h-7 bg-primary/20 text-primary hover:bg-primary/30 border-0">
            <Plus className="h-3 w-3" /> Adicionar Perfil
          </Button>
        </div>

        {formData.profiles.map((profile, index) => (
          <ProfileCard
            key={index}
            index={index}
            profile={profile}
            expanded={expandedProfiles.includes(index)}
            onToggle={() => toggleProfile(index)}
            onUpdate={(updates) => updateProfile(index, updates)}
            onRemove={() => removeProfile(index)}
            canRemove={formData.profiles.length > 1}
            extractIdFromUrl={extractIdFromUrl}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <Button type="button" variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white hover:bg-white/5">Voltar</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Combo ({formData.profiles.filter(p => p.linkPerfil || p.idPerfil || p.emailAcesso).length} perfis)
        </Button>
      </div>
    </div>
  );
}

// ─── Profile Card (collapsible) ───
function ProfileCard({
  index, profile, expanded, onToggle, onUpdate, onRemove, canRemove, extractIdFromUrl,
}: {
  index: number;
  profile: ProfileData;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<ProfileData>) => void;
  onRemove: () => void;
  canRemove: boolean;
  extractIdFromUrl: (url: string) => string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const hasData = !!(profile.nomePerfil || profile.linkPerfil || profile.emailAcesso);

  return (
    <div className={`glass-panel rounded-xl overflow-hidden transition-all ${hasData ? "border-primary/20" : ""}`}>
      {/* Header - always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${hasData ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"}`}>
            {index + 1}
          </div>
          <div className="text-left">
            <p className={`text-sm font-medium ${hasData ? "text-white" : "text-zinc-500"}`}>
              {profile.nomePerfil || `Perfil ${index + 1}`}
            </p>
            {profile.emailAcesso && <p className="text-[11px] text-zinc-500">{profile.emailAcesso}</p>}
          </div>
          {hasData && <Badge className="bg-green-500/20 text-green-400 text-[10px]">Preenchido</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {canRemove && (
            <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
        </div>
      </button>

      {/* Expanded Form */}
      {expanded && (
        <div className="p-4 pt-0 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
            {/* Left - Identificação */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-bold text-white">Identificação</h3>
              </div>
              <Field label="Nome do Perfil" icon={CircleUser} placeholder="Nome completo">
                <Input value={profile.nomePerfil} onChange={e => onUpdate({ nomePerfil: e.target.value })} placeholder="Nome completo" className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 h-9 text-sm" />
              </Field>
              <Field label="Link do Perfil" icon={Link} placeholder="">
                <Input value={profile.linkPerfil} onChange={e => {
                  const url = e.target.value;
                  onUpdate({ linkPerfil: url, idPerfil: extractIdFromUrl(url) || profile.idPerfil });
                }} placeholder="https://facebook.com/profile.php?id=..." className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 h-9 text-sm" />
              </Field>
              <Field label="ID do Perfil" icon={Hash} placeholder="">
                <Input value={profile.idPerfil} readOnly className="pl-10 bg-black/30 border-white/5 text-white font-mono h-9 text-sm" />
              </Field>
              <Field label="E-mail" icon={Mail} placeholder="">
                <Input type="email" value={profile.emailAcesso} onChange={e => onUpdate({ emailAcesso: e.target.value })} placeholder="email@exemplo.com" className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 h-9 text-sm" />
              </Field>
              <Field label="Senha Email" icon={KeyRound} placeholder="">
                <Input value={profile.senhaEmail} onChange={e => onUpdate({ senhaEmail: e.target.value })} placeholder="Senha do email" className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 h-9 text-sm" />
              </Field>
              <Field label="Email Alternativo" icon={AtSign} placeholder="">
                <Input type="email" value={profile.emailAlternativo} onChange={e => onUpdate({ emailAlternativo: e.target.value })} placeholder="recuperacao@email.com" className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 h-9 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-zinc-400">Nascimento</label>
                  <Input type="date" value={profile.dataNascimento} onChange={e => onUpdate({ dataNascimento: e.target.value })} className="bg-black/30 border-white/5 text-white h-9 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-zinc-400">Gênero</label>
                  <Select value={profile.genero} onValueChange={v => onUpdate({ genero: v })}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Field label="Link Documento (opcional)" icon={Link} placeholder="">
                <Input type="url" value={profile.linkDocumento} onChange={e => onUpdate({ linkDocumento: e.target.value })} placeholder="https://drive.google.com/..." className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 h-9 text-sm" />
              </Field>
            </div>

            {/* Right - Segurança */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-bold text-white">Segurança & Status</h3>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Senha FB</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input type={showPassword ? "text" : "password"} value={profile.senha} onChange={e => onUpdate({ senha: e.target.value })} placeholder="Cole a senha aqui" className="pl-10 pr-10 bg-black/30 border-white/5 text-white h-9 text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                    {showPassword ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <Field label="Token 2FA" icon={KeyRound} placeholder="">
                <Input value={profile.token2fa} onChange={e => onUpdate({ token2fa: e.target.value })} placeholder="JBSWY3DPEHPK3PXP" className="pl-10 bg-black/30 border-white/5 text-white font-mono h-9 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-zinc-400">Tempo Plataforma</label>
                  <Select value={profile.tempoPlataforma} onValueChange={v => onUpdate({ tempoPlataforma: v })}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white h-9 text-xs"><SelectValue /></SelectTrigger>
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
                  <label className="text-[11px] font-medium text-zinc-400">Status Atual</label>
                  <Select value={profile.statusAtual} onValueChange={v => onUpdate({ statusAtual: v })}>
                    <SelectTrigger className="bg-black/30 border-white/5 text-white h-9 text-xs"><SelectValue /></SelectTrigger>
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
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1"><Cookie className="h-3 w-3" />Cookies</label>
                <Textarea placeholder='[{"domain": ".facebook.com", ...}]' value={profile.cookies} onChange={e => onUpdate({ cookies: e.target.value })} className="h-16 bg-black/30 border-white/5 text-zinc-300 font-mono text-xs resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1"><FileText className="h-3 w-3" />Notas</label>
                <Textarea placeholder="Obs sobre este perfil..." value={profile.descricao} onChange={e => onUpdate({ descricao: e.target.value })} className="h-16 bg-black/30 border-white/5 text-white resize-none text-sm" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Field wrapper ───
function Field({ label, icon: Icon, children }: { label: string; icon: any; placeholder: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        {children}
      </div>
    </div>
  );
}
