import { useState } from "react";
import { FbFinanceSidebar } from "./FbFinanceSidebar";
import { FbDashboardHome } from "./FbDashboardHome";
import { FbLancamentos } from "./FbLancamentos";
import { FbCaixas } from "./FbCaixas";
import { FbDistribuicaoPJ } from "./FbDistribuicaoPJ";
import { FbPlanejamentoPessoal } from "./FbPlanejamentoPessoal";
import { FbRelatorios } from "./FbRelatorios";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, X } from "lucide-react";

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

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6 bg-[#060d18]">
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-20 left-4 z-[80] p-2 rounded-lg bg-blue-600 text-white shadow-lg"
        >
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      )}

      {/* Sidebar */}
      {(isMobile && sidebarOpen) && (
        <div className="fixed inset-0 z-[70] bg-black/60" onClick={() => setSidebarOpen(false)} />
      )}
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
      <div className="flex-1 overflow-y-auto p-6">
        {renderPage()}
      </div>
    </div>
  );
}
