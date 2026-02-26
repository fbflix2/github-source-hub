import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
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
  ShieldCheck
} from "lucide-react";

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { title: "Suporte", icon: Headphones, path: "/admin/suporte" },
  { title: "Auditoria", icon: ClipboardCheck, path: "/admin/auditoria" },
  { title: "Estoque", icon: Warehouse, path: "/admin/estoque" },
  { title: "Produtos", icon: Package, path: "/admin/produtos" },
  { title: "Pedidos", icon: ShoppingCart, path: "/admin/pedidos" },
  { title: "Pagamentos", icon: CreditCard, path: "/admin/pagamentos" },
  { title: "Carrinhos Abandonados", icon: ShoppingCart, path: "/admin/carrinhos-abandonados" },
  { title: "Assinaturas", icon: Monitor, path: "/admin/assinaturas" },
  { title: "Central Proxy", icon: Globe, path: "/admin/central-proxy" },
  { title: "Clientes", icon: Users, path: "/admin/clientes" },
  { title: "Afiliados", icon: UserCheck, path: "/admin/afiliados" },
  { title: "Cupons", icon: Ticket, path: "/admin/cupons" },
  { title: "Tutoriais", icon: GraduationCap, path: "/admin/tutoriais" },
  { title: "Anúncios", icon: Megaphone, path: "/admin/anuncios" },
  { title: "Notificações", icon: Bell, path: "/admin/notificacoes" },
  { title: "Termos de uso", icon: FileText, path: "/admin/termos" },
  { title: "Configurações", icon: Settings, path: "/admin/configuracoes", subItems: [
    { title: "Plataforma", icon: Palette, path: "/admin/configuracoes/plataforma" },
    { title: "Banners", icon: Image, path: "/admin/banners" },
    { title: "Usuários e Acessos", icon: ShieldCheck, path: "/admin/configuracoes/usuarios" },
  ]},
  { title: "API | Token", icon: Key, path: "/admin/api" },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const location = useLocation();

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
          <div className="relative flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
            <Play className="text-white size-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h1 className="text-white text-sm font-bold tracking-tight">
                FBFLIX <span className="text-primary">Admin</span>
              </h1>
              <p className="text-white/40 text-[10px] font-medium">v2.0 Dashboard</p>
            </div>
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
                      isActive && !hasSubItems ? "text-white" : "group-hover:text-primary"
                    )} />
                    {!collapsed && (
                      <>
                        <span className="text-xs font-medium flex-1">{item.title}</span>
                        {hasSubItems && (
                          <ChevronDown className={cn(
                            "size-3 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )} />
                        )}
                      </>
                    )}
                  </NavLink>
                </div>
                
                {/* Sub Items */}
                {hasSubItems && isExpanded && !collapsed && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {item.subItems.map((sub) => {
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
