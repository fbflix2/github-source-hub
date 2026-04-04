import { useState } from "react";
import { FbFinanceSidebar } from "./FbFinanceSidebar";
import { FbDashboardHome } from "./FbDashboardHome";
import { FbLancamentos } from "./FbLancamentos";
import { FbCaixas } from "./FbCaixas";
import { FbDistribuicaoPJ } from "./FbDistribuicaoPJ";
import { FbPlanejamentoPessoal } from "./FbPlanejamentoPessoal";
import { FbRelatorios } from "./FbRelatorios";
import { FbMapaFluxo } from "./FbMapaFluxo";
import { FbCustosPessoais } from "./FbCustosPessoais";
import { FbCalendarModal } from "./FbCalendarModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";

export type FbPage = "dashboard" | "lancamentos" | "caixas" | "distribuicao" | "planejamento" | "relatorios" | "mapa_fluxo" | "custos_pessoais";

export function FbFinanceDashboard() {
  const [currentPage, setCurrentPage] = useState<FbPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const isMobile = useIsMobile();

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <FbDashboardHome onNavigate={setCurrentPage} />;
      case "lancamentos": return <FbLancamentos />;
      case "caixas": return <FbCaixas />;
      case "distribuicao": return <FbDistribuicaoPJ />;
      case "planejamento": return <FbPlanejamentoPessoal />;
      case "relatorios": return <FbRelatorios />;
      case "mapa_fluxo": return <FbMapaFluxo onNavigate={setCurrentPage} />;
      case "custos_pessoais": return <FbCustosPessoais />;
      default: return <FbDashboardHome onNavigate={setCurrentPage} />;
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) + " • " + now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric" });

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (q.includes("lança") || q.includes("entrada") || q.includes("saida")) setCurrentPage("lancamentos");
      else if (q.includes("caixa") || q.includes("envelope")) setCurrentPage("caixas");
      else if (q.includes("distrib") || q.includes("aloca")) setCurrentPage("distribuicao");
      else if (q.includes("planej") || q.includes("despesa") || q.includes("pessoal")) setCurrentPage("planejamento");
      else if (q.includes("relat") || q.includes("histor")) setCurrentPage("relatorios");
      else if (q.includes("mapa") || q.includes("fluxo")) setCurrentPage("mapa_fluxo");
      else toast({ title: `Nenhum resultado para "${searchQuery}"` });
      setSearchQuery("");
    }
  };

  return (
    <div className="flex h-screen" style={{ background: "#051424", color: "#d5e4fa", fontFamily: "'Inter', sans-serif" }}>
      {isMobile && (
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-20 left-4 z-[80] p-2 rounded-lg bg-[#1976d2] text-white shadow-lg">
          <span className="material-symbols-outlined">{sidebarOpen ? "close" : "menu"}</span>
        </button>
      )}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`${isMobile ? "fixed left-0 top-0 bottom-0 z-[75] transition-transform duration-200" : "relative"} ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}`}>
        <FbFinanceSidebar currentPage={currentPage} onNavigate={(page) => { setCurrentPage(page); setSidebarOpen(false); }} />
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        <header className="sticky top-0 z-50 w-full px-8 py-4 border-b border-white/10 flex justify-between items-center" style={{ background: "#051424", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}>
          <div>
            <h2 className="font-['Manrope'] font-bold text-lg tracking-tight text-[#1976d2]">Fb Finance</h2>
            <p className="text-slate-400 text-xs font-medium capitalize">{dateStr}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
              <input
                className="border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#1976d2] w-64"
                style={{ background: "#0e1c2d", color: "#d5e4fa" }}
                placeholder="Buscar módulo... (Enter)"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <button onClick={() => setCalendarOpen(true)} className="hover:bg-white/5 p-2 rounded-full transition-colors" title="Calendário Financeiro">
                <span className="material-symbols-outlined">calendar_today</span>
              </button>
              <button onClick={() => setCurrentPage("relatorios")} className="hover:bg-white/5 p-2 rounded-full transition-colors relative" title="Relatórios">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#40e56c] rounded-full"></span>
              </button>
              <button onClick={() => setCurrentPage("distribuicao")} className="hover:bg-white/5 p-2 rounded-full transition-colors" title="Configurações de Distribuição">
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
          {renderPage()}
        </div>
      </div>

      {/* FAB - Navigate to Lançamentos */}
      <button
        onClick={() => setCurrentPage("lancamentos")}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#1976d2] text-white rounded-full shadow-2xl shadow-blue-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
        title="Novo Lançamento"
      >
        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>

      <FbCalendarModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </div>
  );
}
