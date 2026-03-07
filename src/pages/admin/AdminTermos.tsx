import { useState } from "react";
import { Gavel, ShieldCheck, Eye, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function AdminTermos() {
  const [termosUso, setTermosUso] = useState(`1. ACEITAÇÃO DOS TERMOS
Ao acessar e usar a plataforma FBFLIX, você aceita e concorda em estar vinculado pelos termos e disposições deste acordo. Além disso, ao usar os serviços particulares deste site, você estará sujeito a quaisquer regras ou diretrizes publicadas aplicáveis a tais serviços.

2. DESCRIÇÃO DO SERVIÇO
A FBFLIX fornece aos usuários acesso a uma rica coleção de recursos, incluindo várias ferramentas de comunicação, fóruns de busca, conteúdo personalizado e programação de marca através de sua rede de propriedades.

3. MODIFICAÇÕES NO SERVIÇO
A FBFLIX reserva-se o direito de a qualquer momento e de tempos em tempos modificar ou descontinuar, temporária ou permanentemente, o Serviço (ou qualquer parte dele) com ou sem aviso prévio.`);

  const [termosGarantia, setTermosGarantia] = useState(`POLÍTICA DE REEMBOLSO E GARANTIA

Oferecemos uma garantia de satisfação de 7 dias. Se você não estiver satisfeito com nosso serviço por qualquer motivo, poderá solicitar um reembolso total dentro de 7 dias após a compra inicial.

Para assinaturas mensais, você pode cancelar a qualquer momento, e o acesso continuará até o final do período de faturamento atual.`);

  const [termosUsoStatus] = useState<"published" | "draft">("published");
  const [termosGarantiaStatus] = useState<"published" | "draft">("draft");

  const ToolbarButton = ({ children, title }: { children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
    >
      {children}
    </button>
  );

  const Separator = () => <div className="w-px h-6 bg-white/10 mx-1" />;

  return (
    <div className="flex flex-col items-center w-full py-8 px-2 md:px-4">
      <main className="w-full max-w-4xl flex flex-col gap-10">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/10">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
              Gerenciamento de <span className="text-primary">Termos</span>
            </h1>
            <p className="text-white/60 text-lg font-light max-w-lg">
              Edite e publique os documentos legais que regem o uso da plataforma e garantias.
            </p>
          </div>
          <Button
            variant="outline"
            className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30"
          >
            <Eye className="w-5 h-5 text-white/80 group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-white/90">Visualizar como Cliente</span>
          </Button>
        </header>

        {/* Section: Termos de Uso */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Gavel className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Termos de Uso</h2>
            </div>
            <span
              className={`text-xs font-mono px-2 py-1 rounded border ${
                termosUsoStatus === "published"
                  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                  : "text-amber-400 bg-amber-400/10 border-amber-400/20"
              }`}
            >
              {termosUsoStatus === "published" ? "Publicado" : "Rascunho"}
            </span>
          </div>

          {/* Editor Container */}
          <div className="bg-[rgba(35,16,16,0.7)] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-lg">
            {/* Toolbar */}
            <div className="flex items-center flex-wrap gap-1 p-2 border-b border-white/10 bg-black/20">
              <ToolbarButton title="Bold"><Bold className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Italic"><Italic className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Underline"><Underline className="w-5 h-5" /></ToolbarButton>
              <Separator />
              <ToolbarButton title="Align Left"><AlignLeft className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Align Center"><AlignCenter className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Align Right"><AlignRight className="w-5 h-5" /></ToolbarButton>
              <Separator />
              <ToolbarButton title="Bullet List"><List className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Numbered List"><ListOrdered className="w-5 h-5" /></ToolbarButton>
              <Separator />
              <ToolbarButton title="Insert Link"><Link className="w-5 h-5" /></ToolbarButton>
              <div className="flex-1" />
              <span className="text-xs text-white/40 px-3 font-mono">HTML View</span>
            </div>

            {/* Editor Area */}
            <Textarea
              value={termosUso}
              onChange={(e) => setTermosUso(e.target.value)}
              placeholder="Comece a digitar os Termos de Uso aqui..."
              className="w-full bg-transparent text-white/90 p-6 min-h-[320px] resize-y focus:outline-none placeholder:text-white/20 leading-relaxed font-light border-none focus:ring-0 rounded-none"
            />

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-black/20">
              <span className="text-xs text-white/40 pl-2">Última edição: 24/10/2023 às 14:30 por Admin</span>
              <Button className="flex items-center gap-2 rounded-xl h-11 px-6 bg-primary hover:bg-red-600 active:bg-red-700 text-white shadow-lg shadow-red-900/20">
                <Save className="w-5 h-5" />
                <span className="font-bold text-sm tracking-wide">Salvar Termos de Uso</span>
              </Button>
            </div>
          </div>
        </section>

        {/* Spacer */}
        <div className="h-8 border-l border-dashed border-white/10 ml-8 my-2" />

        {/* Section: Termos de Garantia */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Termos de Garantia</h2>
            </div>
            <span
              className={`text-xs font-mono px-2 py-1 rounded border ${
                termosGarantiaStatus === "published"
                  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                  : "text-amber-400 bg-amber-400/10 border-amber-400/20"
              }`}
            >
              {termosGarantiaStatus === "published" ? "Publicado" : "Rascunho"}
            </span>
          </div>

          {/* Editor Container */}
          <div className="bg-[rgba(35,16,16,0.7)] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-lg">
            {/* Toolbar */}
            <div className="flex items-center flex-wrap gap-1 p-2 border-b border-white/10 bg-black/20">
              <ToolbarButton title="Bold"><Bold className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Italic"><Italic className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Underline"><Underline className="w-5 h-5" /></ToolbarButton>
              <Separator />
              <ToolbarButton title="Align Left"><AlignLeft className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Align Center"><AlignCenter className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Align Right"><AlignRight className="w-5 h-5" /></ToolbarButton>
              <Separator />
              <ToolbarButton title="Bullet List"><List className="w-5 h-5" /></ToolbarButton>
              <ToolbarButton title="Numbered List"><ListOrdered className="w-5 h-5" /></ToolbarButton>
            </div>

            {/* Editor Area */}
            <Textarea
              value={termosGarantia}
              onChange={(e) => setTermosGarantia(e.target.value)}
              placeholder="Descreva a política de garantia e reembolso..."
              className="w-full bg-transparent text-white/90 p-6 min-h-[240px] resize-y focus:outline-none placeholder:text-white/20 leading-relaxed font-light border-none focus:ring-0 rounded-none"
            />

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-black/20">
              <span className="text-xs text-white/40 pl-2">Alterações não salvas</span>
              <Button className="flex items-center gap-2 rounded-xl h-11 px-6 bg-primary hover:bg-red-600 active:bg-red-700 text-white shadow-lg shadow-red-900/20">
                <Save className="w-5 h-5" />
                <span className="font-bold text-sm tracking-wide">Salvar Termos de Garantia</span>
              </Button>
            </div>
          </div>
        </section>

        {/* Bottom Spacer */}
        <div className="h-20" />
      </main>
    </div>
  );
}
