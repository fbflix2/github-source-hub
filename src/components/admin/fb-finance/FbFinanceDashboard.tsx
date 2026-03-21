import { useState } from "react";
import { FbFinanceSidebar } from "./FbFinanceSidebar";
import { FbDashboardHome } from "./FbDashboardHome";
import { FbLancamentos } from "./FbLancamentos";
import { FbCaixas } from "./FbCaixas";
import { FbDistribuicaoPJ } from "./FbDistribuicaoPJ";
import { FbPlanejamentoPessoal } from "./FbPlanejamentoPessoal";
import { FbRelatorios } from "./FbRelatorios";
import { useIsMobile } from "@/hooks/use-mobile";

export type FbPage = "dashboard" | "lancamentos" | "caixas" | "distribuicao" | "planejamento" | "relatorios";

export function FbFinanceDashboard() {
  const [currentPage, setCurrentPage] = useState<FbPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <FbDashboardHome onNavigate={setCurrentPage} />;
      case "lancamentos": return <FbLancamentos />;
      case "caixas": return <FbCaixas />;
      case "distribuicao": return <FbDistribuicaoPJ />;
      case "planejamento": return <FbPlanejamentoPessoal />;
      case "relatorios": return <FbRelatorios />;
      default: return <FbDashboardHome onNavigate={setCurrentPage} />;
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) + " • " + now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric" });

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6" style={{ background: "#051424", color: "#d5e4fa", fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-20 left-4 z-[80] p-2 rounded-lg bg-[#1976d2] text-white shadow-lg"
        >
          <span className="material-symbols-outlined">{sidebarOpen ? "close" : "menu"}</span>
        </button>
      )}

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        ${isMobile ? "fixed left-0 top-0 bottom-0 z-[75] transition-transform duration-200" : "relative"}
        ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
      `}>
        <FbFinanceSidebar
          currentPage={currentPage}
          onNavigate={(page) => {
            setCurrentPage(page);
            setSidebarOpen(false);
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-50 w-full px-8 py-4 border-b border-white/10 flex justify-between items-center" style={{ background: "#051424", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}>
          <div>
            <h2 className="font-['Manrope'] font-bold text-lg tracking-tight text-[#1976d2]">Dashboard Financeiro Integrado - Fb</h2>
            <p className="text-slate-400 text-xs font-medium capitalize">{dateStr}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
              <input
                className="border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#1976d2] w-64"
                style={{ background: "#0e1c2d", color: "#d5e4fa" }}
                placeholder="Buscar dados..."
                type="text"
              />
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <button className="hover:bg-white/5 p-2 rounded-full transition-colors"><span className="material-symbols-outlined">calendar_today</span></button>
              <button className="hover:bg-white/5 p-2 rounded-full transition-colors relative">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#40e56c] rounded-full"></span>
              </button>
              <button className="hover:bg-white/5 p-2 rounded-full transition-colors"><span className="material-symbols-outlined">settings</span></button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
          {renderPage()}
        </div>
      </div>

      {/* FAB */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-[#1976d2] text-white rounded-full shadow-2xl shadow-blue-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>
    </div>
  );
}
