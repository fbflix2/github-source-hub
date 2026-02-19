import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface ProfileFormData {
  address: string;
  cep: string;
  whatsapp: string;
  email: string;
}

export default function Profile() {
  const [formData, setFormData] = useState<ProfileFormData>({
    address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
    cep: "01310-100",
    whatsapp: "(11) 99999-9999",
    email: "alexandre.g@email.com",
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Perfil atualizado!",
      description: "Suas informações foram salvas com sucesso.",
    });
  };

  const handleCancel = () => {
    setFormData({
      address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
      cep: "01310-100",
      whatsapp: "(11) 99999-9999",
      email: "alexandre.g@email.com",
    });
    toast({
      title: "Alterações canceladas",
      description: "As informações foram restauradas.",
    });
  };

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
          <div className="glass-panel rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
            {/* Top gradient */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent"></div>
            
            {/* Avatar */}
            <div className="relative mb-6 z-10">
              <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-red-400 via-red-600 to-red-800 mx-auto">
                <div className="w-full h-full rounded-full bg-card border-4 border-card flex items-center justify-center text-4xl font-bold text-primary">
                  AG
                </div>
              </div>
              <button 
                className="absolute bottom-1 right-1 bg-card text-primary p-2 rounded-full border border-border hover:bg-primary hover:text-primary-foreground transition-all shadow-lg"
                title="Alterar Foto"
              >
                <span className="material-symbols-outlined text-xl">photo_camera</span>
              </button>
            </div>
            
            <h2 className="text-xl font-bold text-foreground">Alexandre G.</h2>
            <p className="text-primary font-medium text-sm mb-6">Membro Premium</p>
            
            {/* User Stats */}
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-border">
                <span className="text-muted-foreground text-sm">Status da Conta</span>
                <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span> Ativa
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-border">
                <span className="text-muted-foreground text-sm">Membro desde</span>
                <span className="text-foreground text-sm">Junho 2023</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-border">
                <span className="text-muted-foreground text-sm">Último Login</span>
                <span className="text-foreground text-sm">Hoje, 14:30</span>
              </div>
            </div>
            
            {/* Upload Button */}
            <div className="mt-8 w-full">
              <button className="w-full bg-secondary hover:bg-secondary/80 text-foreground border border-dashed border-border hover:border-primary/50 hover:text-primary font-medium py-2.5 px-6 rounded-lg transition-all duration-200 text-sm">
                Upload Nova Foto
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="lg:col-span-2">
          {/* Personal Information Card */}
          <div className="glass-panel rounded-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Informações Pessoais
              </h3>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded border border-border">Editável</span>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Address - Full Width */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Endereço Completo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">location_on</span>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Digite seu endereço"
                      className="input-field pl-12"
                    />
                  </div>
                </div>
                
                {/* CEP */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">CEP</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">map</span>
                    <input
                      type="text"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      placeholder="00000-000"
                      className="input-field pl-12"
                    />
                  </div>
                </div>
                
                {/* WhatsApp */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">WhatsApp</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">chat</span>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="input-field pl-12"
                    />
                  </div>
                </div>
                
                {/* Email - Full Width */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Email Principal</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-muted-foreground text-lg">email</span>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="seu@email.com"
                      className="input-field pl-12"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/60 ml-1">Este email será usado para notificações de compra e recuperação de senha.</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border mt-8">
                <button 
                  type="button" 
                  className="text-danger hover:text-red-400 text-sm font-medium transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Excluir Conta
                </button>
                <div className="flex gap-4 w-full sm:w-auto">
                  <button 
                    type="button" 
                    onClick={handleCancel}
                    className="bg-secondary hover:bg-secondary/80 text-foreground border border-border font-medium py-2.5 px-6 rounded-lg transition-all duration-200 w-full sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] w-full sm:w-auto flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">save</span>
                    Salvar Alterações
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
