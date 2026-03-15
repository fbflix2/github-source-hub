import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Home", path: "/admin", icon: "grid_view", exact: true },
  { title: "Produtos", path: "/admin/produtos", icon: "inventory_2", exact: false },
  { title: "Pedidos", path: "/admin/pedidos", icon: "receipt_long", exact: false },
  { title: "Ajustes", path: "/admin/configuracoes", icon: "settings", exact: false },
];

export function AdminMobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-2xl border-t border-white/5 px-8 py-3">
      <div className="flex items-center justify-between max-w-md mx-auto h-12">
        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex flex-col items-center gap-1 transition-colors",
                isActive ? "text-white" : "text-zinc-500"
              )}
            >
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              <span className="text-[9px] font-bold">{item.title}</span>
              {isActive && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
