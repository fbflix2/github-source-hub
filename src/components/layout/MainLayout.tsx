import { useState, useRef, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Navbar } from "./Navbar";
import { MessageCircleQuestion, Ticket } from "lucide-react";
import atendenteAvatar from "@/assets/atendente-avatar.jpeg";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { WaitlistStockAlert } from "@/components/WaitlistStockAlert";

interface MainLayoutProps {
  userName: string;
  userEmail: string;
  onLogout: () => void;
  unreadTickets?: number;
}

const WHATSAPP_NUMBER = "5511999999999"; // Substitua pelo número real
const WHATSAPP_MESSAGE = encodeURIComponent("oi tenho uma dúvida rápida");

export function MainLayout({ userName, userEmail, onLogout, unreadTickets = 0 }: MainLayoutProps) {
  const [balance, setBalance] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let userId: string | null = null;

    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
      const { data } = await supabase.from("profiles").select("balance, avatar_url").eq("user_id", user.id).maybeSingle();
      if (data) {
        setBalance(data.balance);
        setAvatarUrl(data.avatar_url);
      }
    }
    fetchProfile();

    // Realtime subscription for instant balance updates
    const channel = supabase
      .channel("profile-balance")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        if (userId && payload.new && (payload.new as any).user_id === userId) {
          setBalance((payload.new as any).balance ?? 0);
          if ((payload.new as any).avatar_url !== undefined) {
            setAvatarUrl((payload.new as any).avatar_url);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  const [showSupportMenu, setShowSupportMenu] = useState(false);
  const supportMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (supportMenuRef.current && !supportMenuRef.current.contains(event.target as Node)) {
        setShowSupportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDuvidaRapida = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`, "_blank");
    setShowSupportMenu(false);
  };

  const handleSuporte = () => {
    navigate("/suporte");
    setShowSupportMenu(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-display selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      <Navbar
        userName={userName}
        userEmail={userEmail}
        balance={balance}
        avatarUrl={avatarUrl || undefined}
        onLogout={onLogout}
        unreadTickets={unreadTickets}
      />

      {/* Main Content */}
      <main className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Waitlist stock alert popup */}
      <WaitlistStockAlert />

      {/* Floating Help Button with Dropdown */}
      <div className="fixed bottom-6 right-6 z-40" ref={supportMenuRef}>
        {/* Dropdown Menu */}
        {showSupportMenu && (
          <div className="absolute bottom-16 right-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={handleDuvidaRapida}
              className="flex items-center gap-3 w-full px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <MessageCircleQuestion className="size-5 text-green-500" />
              <span className="text-sm font-medium">Dúvida Rápida</span>
            </button>
            <div className="h-px bg-white/10" />
            <button
              onClick={handleSuporte}
              className="flex items-center gap-3 w-full px-4 py-3 text-white/80 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <Ticket className="size-5 text-primary" />
              <span className="text-sm font-medium">Suporte</span>
            </button>
          </div>
        )}
        
        <button 
          onClick={() => setShowSupportMenu(!showSupportMenu)}
          className={cn(
            "w-14 h-14 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] flex items-center justify-center hover:scale-110 transition-all relative",
            showSupportMenu && "scale-110"
          )}
        >
          <img src={atendenteAvatar} alt="Atendente" className="w-14 h-14 rounded-full object-cover object-top" />
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
        </button>
      </div>
    </div>
  );
}
