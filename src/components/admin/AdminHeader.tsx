import { Bell, ChevronDown, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AdminHeader() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <header className="flex-none px-6 py-4 flex items-center justify-between z-20">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold text-white tracking-tight">Visão Geral</h2>
        <p className="text-white/40 text-xs">
          Bem-vindo de volta, Admin. Monitoramento em tempo real.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="glass-panel rounded-full p-1.5 relative cursor-pointer hover:bg-white/10 transition-colors">
          <Bell className="size-4 text-white/70" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full border border-[#0a0505]" />
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 glass-panel pl-1.5 pr-3 py-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10" />
              <span className="text-xs font-medium text-white/90">Admin User</span>
              <ChevronDown className="size-3 text-white/50" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-sm">
              <LogOut className="mr-2 size-3.5" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
