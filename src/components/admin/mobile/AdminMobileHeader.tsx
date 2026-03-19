import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminMobileSidebar } from "./AdminMobileSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      <header
        className="fixed top-0 left-0 right-0 z-50 px-6 h-16 flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Hamburger Menu */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-start"
          style={{ color: 'rgba(255,255,255,0.9)' }}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Center Logo */}
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black tracking-tighter text-white">FBFLIX</h1>
          <span className="text-[8px] tracking-[0.2em] font-bold -mt-1 uppercase" style={{ color: '#E50914' }}>Admin</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => navigate("/admin/configuracoes")}
          className="w-9 h-9 rounded-full p-0.5 overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 0 1px rgba(255,255,255,0.05)' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Admin" className="w-full h-full object-cover rounded-full" />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'linear-gradient(to bottom right, #374151, #111827)', color: 'rgba(255,255,255,0.7)' }}
            >
              A
            </div>
          )}
          </button>
        </div>
      </header>

      <AdminMobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
