import { NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, Repeat, ClipboardList, GraduationCap, Megaphone, HandCoins, Store, Wrench } from "lucide-react";
import { useNavVisibility } from "@/hooks/useNavVisibility";
import { cn } from "@/lib/utils";

const allNavItems = [
  { key: "loja", title: "Loja", url: "/loja", icon: ShoppingBag },
  { key: "subscriptions", title: "Assinaturas", url: "/subscriptions", icon: Repeat },
  { key: "orders", title: "Pedidos", url: "/orders", icon: ClipboardList },
  { key: "tutorials", title: "Tutoriais", url: "/tutorials", icon: GraduationCap },
  { key: "advertise", title: "Anuncie", url: "/advertise", icon: Megaphone },
  { key: "ganhe-aqui", title: "Ganhe", url: "/parceria", icon: HandCoins },
  { key: "mercado", title: "Mercado", url: "/mercado", icon: Store },
  { key: "ferramentas", title: "Ferramentas", url: "/ferramentas", icon: Wrench },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { hiddenLinks } = useNavVisibility();
  const navItems = allNavItems.filter(item => !hiddenLinks.includes(item.key));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around px-1 py-1.5 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.url}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[3rem] transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium leading-tight truncate max-w-[3.5rem]">
                {item.title}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
