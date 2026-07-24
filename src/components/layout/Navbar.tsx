import { useState, useEffect } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.webp";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPopup } from "@/components/NotificationBell";
import { Ticket, Handshake, Store } from "lucide-react";
import { useNavVisibility } from "@/hooks/useNavVisibility";
import { FaturamentoMeter } from "@/components/FaturamentoMeter";

interface NavbarProps {
  userName: string;
  userEmail: string;
  balance: number;
  avatarUrl?: string;
  isPartner?: boolean;
  partnerEarned?: number | null;
  isReseller?: boolean;
  resellerOnly?: boolean;
  onLogout: () => void;
  unreadTickets?: number;
  allowedKeys?: string[];
  logoOverride?: string;
  brandNameOverride?: string;
  linkOverrides?: Record<string, string>;
  hideTickets?: boolean;
  hideNotifications?: boolean;
  unauthenticated?: boolean;
  onLoginClick?: () => void;
}

const allNavLinks = [
  { key: "loja", title: "Loja", url: "/loja" },
  { key: "subscriptions", title: "Assinaturas", url: "/subscriptions" },
  { key: "orders", title: "Pedidos", url: "/orders" },
  { key: "tutorials", title: "Tutoriais", url: "/tutorials" },
  { key: "advertise", title: "Anuncie Aqui", url: "/advertise" },
  { key: "ganhe-aqui", title: "Ganhe Aqui", url: "/parceria" },
  { key: "mercado", title: "Mercado", url: "/mercado" },
  { key: "ferramentas", title: "Ferramentas", url: "/ferramentas" },
];

const partnerNavLinks = [
  { key: "overview", title: "Visão Geral", tab: "" },
  { key: "products", title: "Produtos", tab: "products" },
  { key: "journey", title: "Jornada", tab: "journey" },
  { key: "tools", title: "Ferramentas", tab: "tools" },
  { key: "finance", title: "Financeiro", tab: "finance" },
];

export function Navbar({ userName, balance, avatarUrl, isPartner, partnerEarned, isReseller, resellerOnly = false, onLogout, unreadTickets = 0, allowedKeys, logoOverride, brandNameOverride, linkOverrides, hideTickets = false, hideNotifications = false, unauthenticated = false, onLoginClick }: NavbarProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { hiddenLinks } = useNavVisibility();
  const [logoHeight, setLogoHeight] = useState(32);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "landing_page_config").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try {
          const cfg = JSON.parse(data.value);
          if (cfg.hero?.logoHeightClient) {
            setLogoHeight(Number(cfg.hero.logoHeightClient));
          }
        } catch {}
      }
    });
  }, []);

  const isPartnerMode = location.pathname === "/parceria";
  const navLinks = resellerOnly
    ? []
    : allNavLinks
        .filter(link => (allowedKeys ? allowedKeys.includes(link.key) : !hiddenLinks.includes(link.key)))
        .map(link => linkOverrides?.[link.key] ? { ...link, url: linkOverrides[link.key] } : link);
  const currentTab = searchParams.get("tab") || "";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <NavLink to={linkOverrides?.loja || (resellerOnly ? "/revenda" : "/loja")} className="flex items-center select-none cursor-pointer mr-4 ml-4 shrink-0">
          <img src={logoOverride || logoFbflix} alt={brandNameOverride || "FBFLIX"} style={{ height: `${logoHeight}px` }} className="w-auto object-contain mr-2" />
          <span className="sr-only">{brandNameOverride || "FBFLIX"}</span>
        </NavLink>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 whitespace-nowrap">
          {resellerOnly ? (
            <NavLink
              to="/revenda"
              className="font-medium transition-colors relative group text-foreground"
            >
              Painel Revenda
              <span className="absolute -bottom-6 left-0 w-full h-0.5 bg-primary scale-x-100" />
            </NavLink>
          ) : isPartnerMode ? (
            partnerNavLinks.map((link) => {
              const isActive = currentTab === link.tab;
              return (
                <NavLink
                  key={link.key}
                  to={link.tab ? `/parceria?tab=${link.tab}` : "/parceria"}
                  className={`font-medium transition-colors relative group ${
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.title}
                  <span
                    className={`absolute -bottom-6 left-0 w-full h-0.5 bg-primary transition-transform ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </NavLink>
              );
            })
          ) : navLinks.map((link) => {
            const isActive = location.pathname === link.url;
            return (
              <NavLink
                key={link.url}
                to={link.url}
                className={`font-medium transition-colors relative group ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.title}
                <span
                  className={`absolute -bottom-6 left-0 w-full h-0.5 bg-primary transition-transform ${
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </NavLink>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4 shrink-0 whitespace-nowrap">
          {/* Notification Popup Overlay */}
          {!resellerOnly && !hideNotifications && !unauthenticated && <NotificationPopup />}

          {/* Tickets Button */}
          {!resellerOnly && !hideTickets && !unauthenticated && <NavLink
            to="/tickets"
            className="relative flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border hover:border-primary/50 hover:bg-primary/10 transition-all group"
          >
            <Ticket className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
            {unreadTickets > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold animate-pulse">
                {unreadTickets > 9 ? "9+" : unreadTickets}
              </span>
            )}
          </NavLink>}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Balance Badge */}
          {!isPartnerMode && !resellerOnly && !unauthenticated && <NavLink
            to="/wallet"
            className={`hidden sm:flex items-center gap-2 border px-4 py-1.5 rounded-full backdrop-blur-sm transition-colors cursor-pointer group ${
              balance > 0
                ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                : "bg-destructive/10 border-destructive/20 hover:bg-destructive/20"
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] group-hover:animate-pulse ${
              balance > 0 ? "text-emerald-400" : "text-destructive"
            }`}>
              account_balance_wallet
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Saldo
              </span>
              <span className={`text-sm font-bold ${balance > 0 ? "text-emerald-400" : "text-destructive"}`}>
                R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </NavLink>}

          {/* Partner Faturamento Meter (no lugar do saldo) */}
          {isPartner && isPartnerMode && partnerEarned !== null && partnerEarned !== undefined && (
            <FaturamentoMeter earned={partnerEarned} compact />
          )}

          {/* User Profile */}
          {unauthenticated ? (
            <button
              onClick={onLoginClick}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition"
            >
              Entrar
            </button>
          ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer pl-4 border-l border-border">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-semibold text-foreground">{userName.split(' ')[0]}</p>
                </div>
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 ring-2 ring-transparent hover:ring-primary/50 transition-all">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="material-symbols-outlined text-muted-foreground hover:text-foreground transition-colors">
                  expand_more
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              {!resellerOnly && (
                <>
                  <DropdownMenuItem asChild>
                    <NavLink to="/profile" className="flex items-center gap-2 text-foreground">
                      <span className="material-symbols-outlined text-[18px]">person</span>
                      Meu Perfil
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink to="/wallet" className="flex items-center gap-2 text-foreground">
                      <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                      Minha Carteira
                    </NavLink>
                  </DropdownMenuItem>
                </>
              )}
              {isPartner && !resellerOnly && (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild>
                    <NavLink to={isPartnerMode ? "/loja" : "/parceria"} className="flex items-center gap-2 text-foreground">
                      <Handshake className="size-[18px]" />
                      {isPartnerMode ? "Painel Cliente" : "Painel Parceiro"}
                    </NavLink>
                  </DropdownMenuItem>
                </>
              )}
              {isReseller && (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild>
                    <NavLink to="/revenda" className="flex items-center gap-2 text-foreground">
                      <Store className="size-[18px]" />
                      Painel Revenda
                    </NavLink>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-danger focus:text-danger cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] mr-2">logout</span>
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
