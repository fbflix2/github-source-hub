import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminMobileSidebar } from "./AdminMobileSidebar";

export function AdminMobileHeader() {
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    loadProfile();
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
        {/* Hamburger Menu */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-start text-white/90"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Center Logo */}
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black tracking-tighter text-white">FBFLIX</h1>
          <span className="text-[8px] tracking-[0.2em] font-bold text-primary -mt-1 uppercase">Admin</span>
        </div>

        {/* Admin Avatar */}
        <button
          onClick={() => navigate("/admin/configuracoes")}
          className="w-9 h-9 rounded-full border border-white/10 p-0.5 overflow-hidden ring-1 ring-white/5"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Admin" className="w-full h-full object-cover rounded-full" />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-[10px] font-bold text-white/70">
              A
            </div>
          )}
        </button>
      </header>

      <AdminMobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
