import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, Wallet, TrendingUp, CalendarCheck, BarChart3 } from "lucide-react";
import type { FbPage } from "./FbFinanceDashboard";

interface Props {
  currentPage: FbPage;
  onNavigate: (page: FbPage) => void;
}

const menuItems: { page: FbPage; label: string; icon: any }[] = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "lancamentos", label: "Lançamentos", icon: BookOpen },
  { page: "caixas", label: "Caixas / Envelopes", icon: Wallet },
  { page: "distribuicao", label: "Distribuição PJ", icon: TrendingUp },
  { page: "planejamento", label: "Planejamento Pessoal", icon: CalendarCheck },
  { page: "relatorios", label: "Relatórios", icon: BarChart3 },
];

export function FbFinanceSidebar({ currentPage, onNavigate }: Props) {
  return (
    <aside className="w-56 h-full bg-[#0a1525] border-r border-blue-900/20 flex flex-col">
      <div className="px-4 py-5 border-b border-blue-900/20">
        <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Fb Finance
        </h2>
        <p className="text-[10px] text-blue-400/40 mt-0.5">Gestão Financeira Integrada</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-blue-600/20 to-cyan-600/10 text-cyan-400 border border-blue-500/20 shadow-lg shadow-blue-500/5"
                  : "text-blue-300/50 hover:bg-blue-900/20 hover:text-blue-200"
              )}
            >
              <item.icon className={cn("size-4", isActive ? "text-cyan-400" : "")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
