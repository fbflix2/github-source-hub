import type { FbPage } from "./FbFinanceDashboard";

interface Props {
  onNavigate: (page: FbPage) => void;
}

const modules: {
  page: FbPage;
  number: number;
  title: string;
  description: string;
  badge: string;
  badgeStyle: string;
  gradient: string;
  icon: string;
}[] = [
  {
    page: "dashboard", number: 1, title: "Dashboard",
    description: "A central de comando onde o saldo total e os KPIs de saúde financeira residem. Ponto de partida para todas as análises.",
    badge: "HUB CENTRAL", badgeStyle: "bg-[#1976d2] text-white",
    gradient: "from-[#1976d2]/30 to-[#122031]", icon: "dashboard",
  },
  {
    page: "lancamentos", number: 2, title: "Lançamentos",
    description: "Registro granular de cada entrada e saída. Onde os dados brutos são catalogados e categorizados.",
    badge: "TRANSACIONAL", badgeStyle: "bg-[#283647] text-[#c1c6d4]",
    gradient: "from-[#283647]/50 to-[#122031]", icon: "receipt_long",
  },
  {
    page: "caixas", number: 3, title: "Caixas",
    description: "Segmentação de patrimônio por objetivos. Gestão de reserva de emergência e contas correntes.",
    badge: "ESTRUTURAL", badgeStyle: "bg-[#02c953]/20 text-[#40e56c]",
    gradient: "from-[#40e56c]/10 to-[#122031]", icon: "account_balance_wallet",
  },
  {
    page: "distribuicao", number: 4, title: "Distribuição",
    description: "A inteligência por trás da alocação de ativos. Visualização de porcentagens por classe de investimento.",
    badge: "ESTRATÉGICO", badgeStyle: "bg-[#283647] text-[#c1c6d4]",
    gradient: "from-[#1976d2]/20 to-[#122031]", icon: "pie_chart",
  },
  {
    page: "planejamento", number: 5, title: "Planejamento",
    description: "Projeções de longo prazo e metas de aposentadoria. Onde o futuro financeiro é desenhado.",
    badge: "PREDITIVO", badgeStyle: "bg-[#e71a0e]/20 text-[#ffb4a8]",
    gradient: "from-[#e71a0e]/10 to-[#122031]", icon: "event_note",
  },
  {
    page: "relatorios", number: 6, title: "Relatórios",
    description: "Exportação e análise histórica profunda. O fechamento do ciclo de inteligência de dados.",
    badge: "ANALÍTICO", badgeStyle: "bg-[#1976d2]/20 text-[#a5c8ff]",
    gradient: "from-[#a5c8ff]/10 to-[#122031]", icon: "analytics",
  },
];

export function FbMapaFluxo({ onNavigate }: Props) {
  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <section className="mb-12">
        <h1 className="font-['Manrope'] text-4xl md:text-5xl font-extrabold text-[#d5e4fa] tracking-tighter mb-4">
          Mapa do Fluxo Financeiro Integrado
        </h1>
        <p className="text-[#c1c6d4] max-w-2xl text-lg">
          Visualize a arquitetura de informação e o percurso do capital através de todas as camadas do sistema Vault.
        </p>
      </section>

      {/* Flow Map Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {modules.map((mod, idx) => (
          <div key={mod.page} className={`flex flex-col gap-4 group ${idx >= 3 ? "md:mt-8" : ""}`}>
            {/* Card Image Area */}
            <div className="p-1 rounded-2xl border border-white/5 shadow-2xl transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-blue-900/20"
              style={{ background: "#0e1c2d" }}>
              <div className={`relative rounded-xl overflow-hidden aspect-[16/10] bg-gradient-to-br ${mod.gradient} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-[#1976d2]/30" style={{ fontSize: "120px", fontVariationSettings: "'FILL' 1" }}>
                  {mod.icon}
                </span>
                <div className="absolute inset-0 bg-gradient-to-t from-[#051424] via-transparent to-transparent" />
                <div className={`absolute top-4 left-4 ${mod.badgeStyle} text-[10px] font-bold px-2 py-1 rounded`}>
                  {mod.badge}
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="px-2">
              <h3 className="font-['Manrope'] text-xl font-bold text-[#a5c8ff] mb-2">
                {mod.number}. {mod.title}
              </h3>
              <p className="text-sm text-[#c1c6d4] leading-relaxed mb-4">{mod.description}</p>
              <button
                onClick={() => onNavigate(mod.page)}
                className="text-xs font-bold uppercase tracking-widest text-[#40e56c] flex items-center gap-2 hover:translate-x-1 transition-transform"
              >
                Ver Tela Real <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {/* Arrow connector (desktop only, first 2 of each row) */}
            {(idx === 0 || idx === 1 || idx === 3 || idx === 4) && (
              <div className="hidden md:block absolute z-10 text-[#1976d2] opacity-50"
                style={{
                  right: idx % 3 === 0 ? "66%" : idx % 3 === 1 ? "33%" : "0%",
                  top: idx < 3 ? "25%" : "65%",
                  transform: "translateX(50%)",
                }}>
                <span className="material-symbols-outlined text-4xl">trending_flat</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data Integrity Section */}
      <section className="mt-20 p-10 rounded-3xl border border-white/10 overflow-hidden relative"
        style={{ background: "rgba(14, 28, 45, 0.6)", backdropFilter: "blur(20px)" }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#a5c8ff]/10 blur-[100px] -mr-32 -mt-32" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-['Manrope'] text-3xl font-bold text-[#d5e4fa] mb-6">Integridade do Fluxo de Dados</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[#40e56c]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#40e56c]">sync</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#d5e4fa]">Sincronização em Tempo Real</h4>
                  <p className="text-sm text-[#c1c6d4]">
                    Alterações em 'Lançamentos' impactam instantaneamente o 'Dashboard' e a 'Distribuição'.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[#a5c8ff]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#a5c8ff]">security</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#d5e4fa]">Segurança de Camada</h4>
                  <p className="text-sm text-[#c1c6d4]">
                    Protocolo de criptografia de ponta a ponta ativo em todos os nós de navegação.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <div className="text-4xl font-extrabold font-['Manrope'] text-[#a5c8ff] mb-1">06</div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Módulos Ativos</div>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <div className="text-4xl font-extrabold font-['Manrope'] text-[#40e56c] mb-1">100%</div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Integração</div>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <div className="text-4xl font-extrabold font-['Manrope'] text-[#ffb4a8] mb-1">24ms</div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Latência de Sync</div>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <div className="text-4xl font-extrabold font-['Manrope'] text-[#d5e4fa] mb-1">∞</div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Escalabilidade</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
