// Admin layout wrapper with auth check
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { ProxyBRLowBalanceAlert } from "./ProxyBRLowBalanceAlert";
import { PageRequestNotification } from "./PageRequestNotification";
import { PendingSafeBMPopup } from "./PendingSafeBMPopup";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminMobileHeader } from "./mobile/AdminMobileHeader";
import { AdminMobileBottomNav } from "./mobile/AdminMobileBottomNav";

export function AdminLayout() {
  const { isAdmin, loading, role } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [permChecked, setPermChecked] = useState(false);
  const hideHeader = location.pathname === "/admin/blocagem" || location.pathname === "/admin/clientes";
  const isAquecimento = location.pathname === "/admin/aquecimento" || location.pathname === "/admin/esteira-admin";

  // For moderators: check if current path is allowed, redirect to first allowed if not
  useEffect(() => {
    if (loading || !isAdmin) return;

    if (role !== "moderator") {
      setPermChecked(true);
      return;
    }

    const checkAndRedirect = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setPermChecked(true); return; }

        const { data: perms } = await supabase
          .from("moderator_permissions")
          .select("allowed_paths")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!perms?.allowed_paths?.length) {
          setPermChecked(true);
          return;
        }

        const allowed = perms.allowed_paths as string[];
        const effectiveAllowed = [...allowed];
        if (allowed.includes("/admin/estoque") && !allowed.includes("/admin/blocagem")) {
          effectiveAllowed.push("/admin/blocagem");
        }
        if (!effectiveAllowed.includes("/admin/chat")) {
          effectiveAllowed.push("/admin/chat");
        }
        const currentAllowed = effectiveAllowed.some(p => location.pathname === p || location.pathname.startsWith(p + "/"));

        if (!currentAllowed) {
          navigate(allowed[0], { replace: true });
        }
      } catch (err) {
        console.error("Error checking mod permissions:", err);
      } finally {
        setPermChecked(true);
      }
    };

    checkAndRedirect();
  }, [loading, isAdmin, role, location.pathname, navigate]);

  if (loading || !isAdmin || !permChecked) {
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

  // Mobile layout - exact match to native app design
  if (isMobile) {
    return (
      <div className="admin-mobile-wrapper min-h-screen font-sans antialiased">
        <AdminMobileHeader />
        <main className="mt-20 px-5 pb-28 space-y-8">
          <Outlet />
        </main>
        <AdminMobileBottomNav />
        <ProxyBRLowBalanceAlert />
        <PageRequestNotification />
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div className={`flex h-screen w-full relative font-display overflow-hidden selection:bg-primary selection:text-white bg-[#0a0505] text-white`}>
      {/* Background Effects */}
      {!isAquecimento && (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-900/10 rounded-full blur-[100px]" />
        </div>
      )}

      <AdminSidebar />

      <main className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
        {!hideHeader && !isAquecimento && <AdminHeader />}
        <div className={`flex-1 overflow-y-auto ${isAquecimento ? '' : 'px-6 pb-6'}`}>
          <div className={`${isAquecimento ? 'w-full h-full' : 'max-w-7xl mx-auto w-full'}`}>
            <Outlet />
          </div>
        </div>
        <ProxyBRLowBalanceAlert />
        <PageRequestNotification />
      </main>
    </div>
  );
}
