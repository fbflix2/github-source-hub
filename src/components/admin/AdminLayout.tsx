import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Play } from "lucide-react";

export function AdminLayout() {
  const { isAdmin, loading } = useAdminAuth();

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0505]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-gradient-to-br from-primary to-red-900 flex items-center justify-center animate-pulse">
            <Play className="text-white size-5" />
          </div>
          <span className="text-xl font-bold text-white">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full relative bg-[#0a0505] text-white font-display overflow-hidden selection:bg-primary selection:text-white">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
        <AdminHeader />
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
