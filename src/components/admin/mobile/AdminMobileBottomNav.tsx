import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { title: "Home", path: "/admin", icon: "grid_view", exact: true },
  { title: "Produtos", path: "/admin/produtos", icon: "inventory_2", exact: false },
  { title: "Pedidos", path: "/admin/pedidos", icon: "receipt_long", exact: false },
  { title: "Ajustes", path: "/admin/configuracoes", icon: "settings", exact: false },
];

export function AdminMobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-8 py-3" style={{ backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between max-w-md mx-auto h-12">
        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-1 ${isActive ? "text-white" : "text-zinc-500"}`}
            >
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              <span className="text-[9px] font-bold">{item.title}</span>
              {isActive && <div className="admin-mobile-active-indicator" />}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
