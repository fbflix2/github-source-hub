import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProfileFormData {
  full_name: string;
  cpf: string;
  birth_date: string;
  address: string;
  cep: string;
  whatsapp: string;
  email: string;
}

export default function Profile() {
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: "",
    cpf: "",
    birth_date: "",
    address: "",
    cep: "",
    whatsapp: "",
    email: "",
  });
  const [verified, setVerified] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      
      setUserId(session.user.id);
      setFormData(prev => ({ ...prev, email: session.user.email || "" }));

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profile) {
        setFormData({
          full_name: profile.full_name || "",
          cpf: (profile as any).cpf || "",
          birth_date: (profile as any).birth_date || "",
          address: profile.address || "",
          cep: profile.cep || "",
          whatsapp: profile.phone || "",
          email: session.user.email || "",
        });
        setVerified((profile as any).verified || false);
        setDocumentUrl((profile as any).document_url || null);
        setAvatarUrl(profile.avatar_url || null);
      }

      // Fetch user role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .in("role", ["admin", "moderator"]);

      if (roles && roles.length > 0) {
        // Prefer admin over moderator
        const hasAdmin = roles.some(r => r.role === "admin");
        setUserRole(hasAdmin ? "admin" : "moderator");
      }

      setLoading(false);
    };
    loadProfile();
  }, []);

  const isProfileComplete = () => {
    return formData.full_name.trim() !== "" &&
      formData.cpf.trim() !== "" &&
      formData.birth_date !== "" &&
      formData.address.trim() !== "" &&
      formData.cep.trim() !== "" &&
      formData.whatsapp.trim() !== "" &&
      documentUrl !== null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);

    const shouldVerify = isProfileComplete() && !verified;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
        cpf: formData.cpf,
        birth_date: formData.birth_date || null,
        address: formData.address,
        cep: formData.cep,
        phone: formData.whatsapp,
        document_url: documentUrl,
        verified: shouldVerify ? true : verified,
      } as any)
      .eq("user_id", userId);

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      if (shouldVerify) setVerified(true);
      toast({
        title: shouldVerify ? "Perfil verificado! ✅" : "Perfil atualizado!",
        description: shouldVerify
          ? "Parabéns! Seu perfil foi verificado com sucesso."
          : "Suas informações foram salvas com sucesso.",
      });
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/documento.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    setDocumentUrl(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Documento enviado!", description: "Salve as alterações para confirmar." });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 2MB.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: newUrl } as any).eq("user_id", userId);
    setAvatarUrl(newUrl);
    setUploadingAvatar(false);
    toast({ title: "Foto atualizada!", description: "Sua foto de perfil foi alterada." });
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Configurações de Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais e de contato.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 text-sm bg-secondary hover:bg-secondary/80 text-foreground border border-border font-medium py-2.5 px-6 rounded-lg transition-all duration-200">
            <span className="material-symbols-outlined text-lg">history</span>
            Histórico
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1">
          <ProfileCard verified={verified} fullName={formData.full_name} avatarUrl={avatarUrl} onAvatarChange={handleAvatarUpload} uploadingAvatar={uploadingAvatar} userRole={userRole} />
        </div>

        {/* Right Column - Form */}
        <div className="lg:col-span-2">
          <div className="glass-panel rounded-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Informações Pessoais
              </h3>
              <div className="flex items-center gap-2">
                {verified && (
                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Verificado
                  </span>
                )}
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded border border-border">Editável</span>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Nome Completo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">badge</span>
                    <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Seu nome completo" className="input-field pl-12" />
                  </div>
                </div>

                {/* CPF */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">CPF</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">fingerprint</span>
                    <input type="text" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" className="input-field pl-12" maxLength={14} />
                  </div>
                </div>

                {/* Birth Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Data de Nascimento</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">cake</span>
                    <input type="date" value={formData.birth_date} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })} className="input-field pl-12" />
                  </div>
                </div>

                {/* Address */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Endereço Completo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">location_on</span>
                    <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Digite seu endereço" className="input-field pl-12" />
                  </div>
                </div>

                {/* CEP */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">CEP</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">map</span>
                    <input type="text" value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} placeholder="00000-000" className="input-field pl-12" />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">WhatsApp</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">chat</span>
                    <input type="tel" value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(00) 00000-0000" className="input-field pl-12" />
                  </div>
                </div>

                {/* Email */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Email Principal</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">email</span>
                    <input type="email" value={formData.email} disabled className="input-field pl-12 opacity-60 cursor-not-allowed" />
                  </div>
                  <p className="text-xs text-muted-foreground/60 ml-1">Este email é vinculado à sua conta e não pode ser alterado aqui.</p>
                </div>

                {/* Document Upload */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Documento de Identidade (RG ou CNH)</label>
                  <div className="relative">
                    {documentUrl ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                        <span className="material-symbols-outlined text-green-400">task</span>
                        <span className="text-sm text-foreground flex-1">Documento enviado</span>
                        <label className="text-xs text-primary hover:underline cursor-pointer">
                          Substituir
                          <input type="file" accept="image/*,.pdf" onChange={handleDocumentUpload} className="hidden" />
                        </label>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-secondary/30">
                        {uploading ? (
                          <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-muted-foreground text-2xl">upload_file</span>
                            <div>
                              <p className="text-sm text-foreground font-medium">Clique para enviar seu documento</p>
                              <p className="text-xs text-muted-foreground">RG ou CNH (JPG, PNG ou PDF, máx 5MB)</p>
                            </div>
                          </>
                        )}
                        <input type="file" accept="image/*,.pdf" onChange={handleDocumentUpload} className="hidden" disabled={uploading} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Verification hint */}
              {!verified && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="material-symbols-outlined text-primary mt-0.5">info</span>
                  <p className="text-sm text-muted-foreground">
                    Preencha todos os campos e envie um documento para receber o <strong className="text-foreground">selo de verificado</strong>.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border mt-8">
                <button type="button" className="text-destructive hover:text-red-400 text-sm font-medium transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Excluir Conta
                </button>
                <div className="flex gap-4 w-full sm:w-auto">
                  <button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-50">
                    <span className="material-symbols-outlined text-lg">{saving ? "progress_activity" : "save"}</span>
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Security Card */}
          <div className="glass-panel rounded-2xl p-6 mt-6 flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <span className="material-symbols-outlined">lock</span>
              </div>
              <div>
                <h4 className="text-foreground font-medium">Senha e Segurança</h4>
                <p className="text-sm text-muted-foreground">Alterar senha e autenticação de dois fatores</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ verified, fullName, avatarUrl, onAvatarChange, uploadingAvatar, userRole }: { 
  verified: boolean; fullName: string; avatarUrl: string | null; 
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void; uploadingAvatar: boolean;
  userRole: string | null;
}) {
  const initials = fullName
    ? fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="glass-panel rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent"></div>

      <div className="relative mb-6 z-10">
        <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-red-400 via-red-600 to-red-800 mx-auto">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover border-4 border-card" />
          ) : (
            <div className="w-full h-full rounded-full bg-card border-4 border-card flex items-center justify-center text-4xl font-bold text-primary">
              {initials}
            </div>
          )}
        </div>
        {verified && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white p-1 rounded-full shadow-lg" title="Perfil Verificado">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
        )}
        <label className="absolute bottom-1 right-1 bg-card text-primary p-2 rounded-full border border-border hover:bg-primary hover:text-primary-foreground transition-all shadow-lg cursor-pointer" title="Alterar Foto">
          {uploadingAvatar ? (
            <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-xl">photo_camera</span>
          )}
          <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" disabled={uploadingAvatar} />
        </label>
      </div>

      <h2 className="text-xl font-bold text-foreground">{fullName || "Sem nome"}</h2>
      {userRole && (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full mt-1 ${
          userRole === "admin" 
            ? "bg-primary/10 text-primary border border-primary/20" 
            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
        }`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            {userRole === "admin" ? "admin_panel_settings" : "shield"}
          </span>
          {userRole === "admin" ? "Administrador" : "Moderador"}
        </span>
      )}
      <p className="text-primary font-medium text-sm mb-6 mt-1">
        {verified ? "Membro Verificado ✅" : "Membro Premium"}
      </p>

      <div className="w-full space-y-4">
        <div className="flex justify-between items-center py-3 border-b border-border">
          <span className="text-muted-foreground text-sm">Status da Conta</span>
          <span className="text-green-400 text-sm font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400"></span> Ativa
          </span>
        </div>
        <div className="flex justify-between items-center py-3 border-b border-border">
          <span className="text-muted-foreground text-sm">Verificação</span>
          {verified ? (
            <span className="text-green-400 text-sm font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">verified</span> Verificado
            </span>
          ) : (
            <span className="text-yellow-400 text-sm font-medium">Pendente</span>
          )}
        </div>
        <div className="flex justify-between items-center py-3 border-b border-border">
          <span className="text-muted-foreground text-sm">Membro desde</span>
          <span className="text-foreground text-sm">Junho 2023</span>
        </div>
      </div>

      <div className="mt-8 w-full">
        <label className="w-full bg-secondary hover:bg-secondary/80 text-foreground border border-dashed border-border hover:border-primary/50 hover:text-primary font-medium py-2.5 px-6 rounded-lg transition-all duration-200 text-sm cursor-pointer flex items-center justify-center gap-2">
          {uploadingAvatar ? (
            <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Enviando...</>
          ) : (
            "Upload Nova Foto"
          )}
          <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" disabled={uploadingAvatar} />
        </label>
      </div>
    </div>
  );
}
