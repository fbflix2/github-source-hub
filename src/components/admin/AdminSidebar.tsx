import { useState, useEffect } from "react";
import logoFbflix from "@/assets/logo-fbflix.png";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTeamChatNotifications } from "@/hooks/useTeamChatNotifications";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  CreditCard, 
  Users, 
  UserCheck, 
  Ticket, 
  GraduationCap, 
  Image, 
  Bell, 
  FileText, 
  Settings, 
  Key,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Monitor,
  Warehouse,
  Globe,
  ClipboardCheck,
  Headphones,
  Palette,
  Megaphone,
  ShieldCheck,
  MessageCircle,
  Shield,
  Recycle,
  Star,
  RefreshCw,
  ArrowRightLeft,
  Briefcase,
  Coins,
  Flame,
  Store,
  KeyRound,
  ImageIcon
} from "lucide-react";

interface SubItem {
  title: string;
  icon: any;
  path: string;
}

interface MenuItem {
  title: string;
  icon: any;
  path: string;
  subItems?: SubItem[];
}

const allMenuItems: MenuItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { title: "Suporte", icon: Headphones, path: "/admin/suporte" },
  { title: "Auditoria", icon: ClipboardCheck, path: "/admin/auditoria" },
  { title: "Estoque", icon: Warehouse, path: "/admin/estoque" },
  { title: "Blocagem", icon: Shield, path: "/admin/blocagem" },
  { title: "Reciclagem", icon: Recycle, path: "/admin/reciclagem" },
  { title: "Reposições", icon: RefreshCw, path: "/admin/reposicoes" },
  { title: "Trocas", icon: ArrowRightLeft, path: "/admin/trocas" },
  { title: "Gestão BMs", icon: Briefcase, path: "/admin/gestao-bms" },
  { title: "Aquecimento", icon: Flame, path: "/admin/aquecimento" },
  { title: "Produtos", icon: Package, path: "/admin/produtos" },
  { title: "Pedidos", icon: ShoppingCart, path: "/admin/pedidos" },
  { title: "Pagamentos", icon: CreditCard, path: "/admin/pagamentos" },
  { title: "Carrinhos Abandonados", icon: ShoppingCart, path: "/admin/carrinhos-abandonados" },
  { title: "Assinaturas", icon: Monitor, path: "/admin/assinaturas" },
  { title: "Central Proxy", icon: Globe, path: "/admin/central-proxy", subItems: [
    { title: "Webshare", icon: Globe, path: "/admin/central-proxy" },
    { title: "ProxyBR", icon: Globe, path: "/admin/central-proxy/proxybr" },
  ]},
  { title: "Fornecedor AccFace", icon: Store, path: "/admin/fornecedor" },
  { title: "Ferramentas", icon: KeyRound, path: "/admin/ferramentas-2fa", subItems: [
    { title: "Ferramentas", icon: KeyRound, path: "/admin/ferramentas-2fa" },
    { title: "Imagens", icon: ImageIcon, path: "/admin/imagens" },
  ]},
  { title: "Clientes", icon: Users, path: "/admin/clientes" },
  { title: "Afiliados", icon: UserCheck, path: "/admin/afiliados" },
  { title: "Parceiros", icon: Users, path: "/admin/parceiros" },
  { title: "Cupons", icon: Ticket, path: "/admin/cupons" },
  { title: "Anúncios", icon: Megaphone, path: "/admin/anuncios" },
  { title: "Notificações", icon: Bell, path: "/admin/notificacoes" },
  { title: "Chat Equipe", icon: MessageCircle, path: "/admin/chat" },
  { title: "Configurações", icon: Settings, path: "/admin/configuracoes", subItems: [
    { title: "Plataforma", icon: Palette, path: "/admin/configuracoes/plataforma" },
    { title: "Banners", icon: Image, path: "/admin/banners" },
    { title: "Tutoriais", icon: GraduationCap, path: "/admin/tutoriais" },
    { title: "Termos de uso", icon: FileText, path: "/admin/termos" },
    { title: "Bloco Padrão", icon: FileText, path: "/admin/configuracoes/bloco-padrao" },
    { title: "Feedbacks", icon: Star, path: "/admin/configuracoes/feedbacks" },
    { title: "Usuários e Acessos", icon: ShieldCheck, path: "/admin/configuracoes/usuarios" },
    { title: "API | Token", icon: Key, path: "/admin/api" },
    { title: "Clientes Migrados", icon: Users, path: "/admin/configuracoes/migrados" },
    { title: "Token FBX", icon: Coins, path: "/admin/fbx" },
  ]},
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(allMenuItems);
  const location = useLocation();
  const { hasUnread, unreadCount } = useTeamChatNotifications();

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as any });
      if (isAdmin) {
        setMenuItems(allMenuItems);
        return;
      }

      // Check if moderator - fetch permissions
      const { data: perms } = await supabase
        .from("moderator_permissions")
        .select("allowed_paths")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!perms || !perms.allowed_paths || perms.allowed_paths.length === 0) {
        // No permissions set = show all (backwards compatible)
        setMenuItems(allMenuItems);
        return;
      }

      const allowed = new Set(perms.allowed_paths as string[]);
      // Blocagem and Reciclagem are sub-features of estoque
      if (allowed.has("/admin/estoque")) {
        allowed.add("/admin/blocagem");
        allowed.add("/admin/reciclagem");
      }
      // Chat is available to all staff
      allowed.add("/admin/chat");

      // Filter menu items
      const filtered = allMenuItems
        .map(item => {
          if (item.subItems) {
            const filteredSubs = item.subItems.filter(sub => allowed.has(sub.path));
            if (filteredSubs.length === 0) return null;
            return { ...item, subItems: filteredSubs };
          }
          return allowed.has(item.path) ? item : null;
        })
        .filter(Boolean) as MenuItem[];

      setMenuItems(filtered);
    } catch (err) {
      console.error("Error checking permissions:", err);
    }
  };

  const toggleExpanded = (path: string) => {
    setExpandedMenus(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  return (
    <aside 
      className={cn(
        "relative z-20 flex flex-col justify-between border-r border-white/5 bg-[#120808]/80 backdrop-blur-md transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo */}
        <div className="flex-none flex items-center gap-2 px-4 py-5">
          <img src={logoFbflix} alt="FBFLIX" className="h-9 w-auto object-contain" />
          {!collapsed && (
            <h1 className="text-white text-sm font-bold tracking-tight">
              FBFLIX <span className="text-primary">Admin</span>
            </h1>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== "/admin" && location.pathname.startsWith(item.path));
            const hasSubItems = 'subItems' in item && item.subItems;
            const isExpanded = expandedMenus.includes(item.path);
            
            return (
              <div key={item.path}>
                <div className="flex items-center">
                  <NavLink
                    to={hasSubItems ? "#" : item.path}
                    onClick={(e) => {
                      if (hasSubItems) {
                        e.preventDefault();
                        toggleExpanded(item.path);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-all group flex-1",
                      isActive && !hasSubItems
                        ? "bg-primary shadow-lg shadow-primary/20 text-white" 
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className={cn(
                      "size-4 transition-colors",
                      isActive && !hasSubItems ? "text-white" : "group-hover:text-primary",
                      item.path === "/admin/chat" && hasUnread && "animate-bounce text-green-400"
                    )} />
                    {!collapsed && (
                      <>
                        <span className={cn(
                          "text-xs font-medium flex-1",
                          item.path === "/admin/chat" && hasUnread && "text-green-400 font-bold"
                        )}>
                          {item.title}
                        </span>
                        {hasSubItems && (
                          <ChevronDown className={cn(
                            "size-3 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )} />
                        )}
                      </>
                    )}
                    {/* Chat unread badge */}
                    {item.path === "/admin/chat" && hasUnread && (
                      <span className="relative flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-green-500 text-white text-[10px] font-bold shadow-lg shadow-green-500/40">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
                        <span className="relative">{unreadCount > 99 ? "99+" : unreadCount}</span>
                      </span>
                    )}
                  </NavLink>
                </div>
                
                {/* Sub Items */}
                {hasSubItems && isExpanded && !collapsed && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {item.subItems!.map((sub) => {
                      const isSubActive = location.pathname === sub.path;
                      return (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-medium",
                            isSubActive
                              ? "bg-primary/20 text-primary"
                              : "text-white/50 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <sub.icon className="size-3.5" />
                          <span>{sub.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse Button */}
        <div className="flex-none p-2 border-t border-white/5">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg h-8 px-3 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <>
                <ChevronLeft className="size-3.5" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
