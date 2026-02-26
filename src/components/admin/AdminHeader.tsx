import { useState, useEffect } from "react";
import { Bell, ChevronDown, LogOut, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminProfileModal } from "./AdminProfileModal";

export function AdminHeader() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Carregando...");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário";
      setUserName(name);
      setAvatarUrl(profile?.avatar_url || user.user_metadata?.avatar_url || null);
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    sessionStorage.clear();
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <>
      <header className="flex-none px-6 py-4 flex items-center justify-end z-20">
        <div className="flex items-center gap-3">
          <div className="glass-panel rounded-full p-1.5 relative cursor-pointer hover:bg-white/10 transition-colors">
            <Bell className="size-4 text-white/70" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full border border-[#0a0505]" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 glass-panel pl-1.5 pr-3 py-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-white/90 max-w-[120px] truncate">{userName}</span>
                <ChevronDown className="size-3 text-white/50" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setShowProfile(true)} className="cursor-pointer text-sm">
                <UserCog className="mr-2 size-3.5" />
                Editar Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-sm">
                <LogOut className="mr-2 size-3.5" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <AdminProfileModal
        open={showProfile}
        onOpenChange={setShowProfile}
        onProfileUpdated={(name, avatar) => {
          setUserName(name);
          setAvatarUrl(avatar);
        }}
      />
    </>
  );
}
