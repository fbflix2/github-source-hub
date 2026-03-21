import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import logoFbflix from "@/assets/logo-fbflix.png";

import {
  LayoutDashboard, Package, ShoppingCart, CreditCard, Users, UserCheck,
  Ticket, GraduationCap, Image, Bell, FileText, Settings, Key,
  Monitor, Warehouse, Globe, ClipboardCheck, Headphones, Palette,
  Megaphone, ShieldCheck, MessageCircle, Shield, Recycle, RefreshCw,
  ArrowRightLeft, Briefcase, Coins, Flame, Store, KeyRound, ImageIcon, Star, Receipt,
} from "lucide-react";

const allMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { title: "Dash Fabricio", icon: Coins, path: "/admin/dash-fabricio" },
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
  { title: "Cobrança Avulsa", icon: Receipt, path: "/admin/cobranca-avulsa" },
  { title: "Assinaturas", icon: Monitor, path: "/admin/assinaturas" },
  { title: "Central Proxy", icon: Globe, path: "/admin/central-proxy" },
  { title: "Fornecedor AccFace", icon: Store, path: "/admin/fornecedor" },
  { title: "Ferramentas", icon: KeyRound, path: "/admin/ferramentas-2fa" },
  { title: "Imagens", icon: ImageIcon, path: "/admin/imagens" },
  { title: "Clientes", icon: Users, path: "/admin/clientes" },
  { title: "Afiliados", icon: UserCheck, path: "/admin/afiliados" },
  { title: "Parceiros", icon: Users, path: "/admin/parceiros" },
  { title: "Cupons", icon: Ticket, path: "/admin/cupons" },
  { title: "Anúncios", icon: Megaphone, path: "/admin/anuncios" },
  { title: "Notificações", icon: Bell, path: "/admin/notificacoes" },
  { title: "Chat Equipe", icon: MessageCircle, path: "/admin/chat" },
  { title: "Configurações", icon: Settings, path: "/admin/configuracoes" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminMobileSidebar({ open, onClose }: Props) {
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    onClose();
  }, [location.pathname]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 left-0 bottom-0 z-[70] w-72 bg-[#0a0505] border-r border-white/5 flex flex-col animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <img src={logoFbflix} alt="FBFLIX" className="h-8 w-auto" />
            <span className="text-white text-sm font-bold">
              FBFLIX <span className="text-primary">Admin</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
            <X className="size-5" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {allMenuItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== "/admin" && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium",
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="size-4" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </>
  );
}
