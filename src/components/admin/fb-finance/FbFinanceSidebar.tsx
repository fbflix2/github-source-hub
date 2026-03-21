import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { FbPage } from "./FbFinanceDashboard";

interface Props {
  currentPage: FbPage;
  onNavigate: (page: FbPage) => void;
}

const menuItems: { page: FbPage; label: string; icon: string }[] = [
  { page: "dashboard", label: "Visão Geral", icon: "dashboard" },
  { page: "lancamentos", label: "Lançamentos Diários", icon: "receipt_long" },
  { page: "caixas", label: "Caixas / Envelopes", icon: "account_balance_wallet" },
  { page: "distribuicao", label: "Distribuição Diária PJ", icon: "share" },
  { page: "planejamento", label: "Planejamento Mensal", icon: "event_note" },
  { page: "relatorios", label: "Relatórios / Histórico", icon: "analytics" },
  { page: "mapa_fluxo", label: "Mapa do Fluxo", icon: "map" },
];

export function FbFinanceSidebar({ currentPage, onNavigate }: Props) {
  const navigate = useNavigate();

  return (
    <aside className="w-72 h-full flex flex-col py-8" style={{ background: "rgba(14, 28, 45, 0.8)", backdropFilter: "blur(20px)", boxShadow: "24px 0 48px rgba(0,0,0,0.4)" }}>
      <div className="px-8 mb-10">
        <h1 className="font-['Manrope'] font-black text-[#1976d2] text-2xl uppercase tracking-widest">FB FINANCE</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={cn(
                "w-full py-3 px-6 flex items-center gap-4 transition-all duration-300 text-left",
                isActive
                  ? "bg-blue-600/10 text-blue-400 border-l-4 border-blue-500"
                  : "text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-1 border-l-4 border-transparent"
              )}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-medium text-sm tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-6 mt-6">
        <div className="p-4 rounded-xl border border-white/5" style={{ background: "#283647" }}>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-2">Instrução</p>
          <p className="text-xs text-[#c1c6d4] leading-relaxed">Clique nos botões do menu para navegar entre todas as telas</p>
        </div>
      </div>

      <div className="mt-auto px-6 space-y-2 pt-4">
        <button
          onClick={() => navigate("/admin")}
          className="text-slate-400 hover:text-white py-2 flex items-center gap-3 transition-colors w-full"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </aside>
  );
}
