import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { ThemeProvider } from "next-themes";
import { useTickets } from "@/hooks/useTickets";
import logoFbflix from "@/assets/logo-fbflix.png";
// Pages
import Auth from "./pages/Auth";
import Loja from "./pages/Loja";
import Checkout from "./pages/Checkout";
import Subscriptions from "./pages/Subscriptions";
import SubscriptionManage from "./pages/SubscriptionManage";
import Orders from "./pages/Orders";
import ItemDetails from "./pages/ItemDetails";
import ItemDetailsHashRedirect from "./pages/ItemDetailsHashRedirect";
import Tutorials from "./pages/Tutorials";
import Wallet from "./pages/Wallet";
import Advertise from "./pages/Advertise";
import Profile from "./pages/Profile";
import GanheAqui from "./pages/GanheAqui";
import ComoFunciona from "./pages/ComoFunciona";
import Suporte from "./pages/Suporte";
import Tickets from "./pages/Tickets";
import NotFound from "./pages/NotFound";
import Welcome from "./pages/Welcome";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Sobre from "./pages/Sobre";
import Mercado from "./pages/Mercado";
import TokenFBX from "./pages/TokenFBX";
import ProductPage from "./pages/ProductPage";
import SaibaMaisFBX from "./pages/SaibaMaisFBX";
import MigrationLogin from "./pages/MigrationLogin";
import Ferramentas from "./pages/Ferramentas";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminEstoque from "./pages/admin/AdminEstoque";
import AdminBlocagem from "./pages/admin/AdminBlocagem";
import AdminSuporte from "./pages/admin/AdminSuporte";
import AdminAuditoria from "./pages/admin/AdminAuditoria";
import AdminNovaCompra from "./pages/admin/AdminNovaCompra";
import AdminNovaVenda from "./pages/admin/AdminNovaVenda";
import AdminBalanco from "./pages/admin/AdminBalanco";
import AdminClientes from "./pages/admin/AdminClientes";
import AdminAfiliados from "./pages/admin/AdminAfiliados";
import AdminCupons from "./pages/admin/AdminCupons";
import AdminTutoriais from "./pages/admin/AdminTutoriais";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminNotificacoes from "./pages/admin/AdminNotificacoes";
import AdminTermos from "./pages/admin/AdminTermos";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import AdminPlataforma from "./pages/admin/AdminPlataforma";
import AdminApi from "./pages/admin/AdminApi";
import AdminAssinaturas from "./pages/admin/AdminAssinaturas";
import AdminPagamentos from "./pages/admin/AdminPagamentos";
import AdminPedidos from "./pages/admin/AdminPedidos";
import AdminCarrinhosAbandonados from "./pages/admin/AdminCarrinhosAbandonados";
import AdminAnuncios from "./pages/admin/AdminAnuncios";
import AdminCentralProxy from "./pages/admin/AdminCentralProxy";
import AdminProxyInterno from "./pages/admin/AdminProxyInterno";
import AdminTeamChat from "./pages/admin/AdminTeamChat";
import AdminBlocoPadrao from "./pages/admin/AdminBlocoPadrao";
import AdminReciclagem from "./pages/admin/AdminReciclagem";
import AdminCentroCustos from "./pages/admin/AdminCentroCustos";
import AdminClientesAtivos from "./pages/admin/AdminClientesAtivos";
import AdminFeedbacks from "./pages/admin/AdminFeedbacks";
import AdminMigrados from "./pages/admin/AdminMigrados";
import AdminReposicoes from "./pages/admin/AdminReposicoes";
import AdminTrocas from "./pages/admin/AdminTrocas";
import AdminGestaoBMs from "./pages/admin/AdminGestaoBMs";
import AdminParceiros from "./pages/admin/AdminParceiros";
import PartnerRedirect from "./pages/PartnerRedirect";
import AdminFBX from "./pages/admin/AdminFBX";
import AdminCentralInvestimentos from "./pages/admin/AdminCentralInvestimentos";
import AdminProjecaoLucro from "./pages/admin/AdminProjecaoLucro";
import AdminMetodologia from "./pages/admin/AdminMetodologia";
import AdminAquecimento from "./pages/admin/AdminAquecimento";
import AdminEsteiraAdmin from "./pages/admin/AdminEsteiraAdmin";
import AdminShopClone from "./pages/admin/AdminShopClone";
import AdminFerramentas2FA from "./pages/admin/AdminFerramentas2FA";
import AdminImageViewer from "./pages/admin/AdminImageViewer";
import AdminProxyBR from "./pages/admin/AdminProxyBR";
import AdminCaixa from "./pages/admin/AdminCaixa";
import AdminSafeBM from "./pages/admin/AdminSafeBM";
import { AdminLayout } from "./components/admin/AdminLayout";

// Layout
import { MainLayout } from "./components/layout/MainLayout";

// Cart
import { CartProvider } from "./contexts/CartContext";
import { FloatingCart } from "./components/FloatingCart";

const queryClient = new QueryClient();

function AuthenticatedApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { totalUnread } = useTickets();
  const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário";
  const userEmail = user.email || "";

  return (
    <Routes>
      <Route
        element={
          <MainLayout
            userName={userName}
            userEmail={userEmail}
            onLogout={onLogout}
            unreadTickets={totalUnread}
          />
        }
      >
        <Route path="/loja" element={<Loja />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/subscriptions/:code" element={<SubscriptionManage />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/item-details" element={<ItemDetailsHashRedirect />} />
        <Route path="/item-details/:orderId/:itemId" element={<ItemDetails />} />
        <Route path="/tutorials" element={<Tutorials />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/advertise" element={<Advertise />} />
        <Route path="/parceria" element={<GanheAqui />} />
        <Route path="/como-funciona" element={<ComoFunciona />} />
        <Route path="/suporte" element={<Suporte />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/mercado" element={<Mercado />} />
        <Route path="/mercado/token-fbx" element={<TokenFBX />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/ferramentas" element={<Ferramentas />} />
        <Route path="/" element={<Navigate to="/loja" replace />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadingTimeout = window.setTimeout(() => {
      if (!mounted) return;
      console.warn('[auth] Initialization timeout, forcing unauthenticated state');
      setSession(null);
      setUser(null);
      setLoading(false);
    }, 8000);

    const finishAuthInit = (nextSession: Session | null) => {
      if (!mounted) return;
      window.clearTimeout(loadingTimeout);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    // IMPORTANT: Do NOT use async/await inside onAuthStateChange to avoid deadlocks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        finishAuthInit(session);

        // On sign-in, check staff redirect in a separate non-blocking call
        if (event === 'SIGNED_IN' && session?.user) {
          const userId = session.user.id;
          const isImpersonated = new URLSearchParams(window.location.search).has('impersonated');

          // Track real client first login (not impersonation)
          if (!isImpersonated) {
            setTimeout(async () => {
              try {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('first_login_at')
                  .eq('user_id', userId)
                  .maybeSingle();
                if (profile && !profile.first_login_at) {
                  await supabase
                    .from('profiles')
                    .update({ first_login_at: new Date().toISOString() })
                    .eq('user_id', userId);
                }
              } catch (err) {
                console.warn('[auth] first_login_at update failed:', err);
              }
            }, 100);
          }

          const redirectKey = `staff_redirect_${userId}`;
          if (sessionStorage.getItem(redirectKey)) return;

          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/admin') || currentPath === '/loja' || currentPath === '/profile' || currentPath === '/wallet' || currentPath.startsWith('/subscriptions') || currentPath.startsWith('/orders') || currentPath.startsWith('/item-details')) return;

          // Use setTimeout to avoid blocking auth state processing
          setTimeout(async () => {
            try {
              const { data: isAdmin } = await supabase.rpc('has_role', {
                _user_id: userId,
                _role: 'admin' as const,
              });
              let isStaff = !!isAdmin;
              if (!isStaff) {
                const { data: isMod } = await supabase.rpc('has_role', {
                  _user_id: userId,
                  _role: 'moderator' as const,
                });
                isStaff = !!isMod;
              }
              if (isStaff) {
                sessionStorage.setItem(redirectKey, 'true');
                window.location.href = '/admin';
              }
            } catch (err) {
              console.warn('[auth] Staff redirect check failed:', err);
            }
          }, 0);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        finishAuthInit(session);
      })
      .catch((err) => {
        console.warn('[auth] getSession failed:', err);
        finishAuthInit(null);
      });

    return () => {
      mounted = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <img src={logoFbflix} alt="FBFLIX" className="w-10 h-10 object-contain animate-pulse" />
          <span className="text-xl font-bold text-foreground">FBFLIX</span>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route
                  path="/auth"
                  element={user ? <Navigate to={sessionStorage.getItem("product_redirect") || "/loja"} replace /> : <Auth />}
                />
                <Route
                  path="/welcome"
                  element={user ? <Welcome /> : <Navigate to="/auth" replace />}
                />
                <Route path="/privacidade" element={<PrivacyPolicy />} />
                <Route path="/termos" element={<TermsOfService />} />
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/produto/:slug" element={<ProductPage />} />
                <Route path="/saiba-mais-fbx" element={<SaibaMaisFBX />} />
                <Route path="/parceiro/:slug" element={<PartnerRedirect />} />
                <Route path="/migrar" element={user ? <Navigate to="/welcome" replace /> : <MigrationLogin />} />

                {/* Admin routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="produtos" element={<AdminProducts />} />
                  <Route path="estoque" element={<AdminEstoque />} />
                  <Route path="blocagem" element={<AdminBlocagem />} />
                  <Route path="reciclagem" element={<AdminReciclagem />} />
                  <Route path="suporte" element={<AdminSuporte />} />
                  <Route path="auditoria" element={<AdminAuditoria />} />
                  <Route path="auditoria/nova-compra" element={<AdminNovaCompra />} />
                  <Route path="auditoria/nova-venda" element={<AdminNovaVenda />} />
                  <Route path="auditoria/balanco" element={<AdminBalanco />} />
                  <Route path="auditoria/centro-custos" element={<AdminCentroCustos />} />
                  <Route path="auditoria/investimentos" element={<AdminCentralInvestimentos />} />
                  <Route path="auditoria/projecao-lucro" element={<AdminProjecaoLucro />} />
                  <Route path="auditoria/metodologia" element={<AdminMetodologia />} />
                  <Route path="auditoria/caixa" element={<AdminCaixa />} />
                  <Route path="pedidos" element={<AdminPedidos />} />
                  <Route path="pagamentos" element={<AdminPagamentos />} />
                  <Route path="carrinhos-abandonados" element={<AdminCarrinhosAbandonados />} />
                  <Route path="assinaturas" element={<AdminAssinaturas />} />
                  <Route path="central-proxy" element={<AdminCentralProxy />} />
                  <Route path="central-proxy/proxybr" element={<AdminProxyBR />} />
                  <Route path="central-proxy/interno" element={<AdminProxyInterno />} />
                  <Route path="clientes" element={<AdminClientes />} />
                  <Route path="clientes/ativos" element={<AdminClientesAtivos />} />
                  <Route path="afiliados" element={<AdminAfiliados />} />
                  <Route path="cupons" element={<AdminCupons />} />
                  <Route path="tutoriais" element={<AdminTutoriais />} />
                  <Route path="banners" element={<AdminBanners />} />
                  <Route path="notificacoes" element={<AdminNotificacoes />} />
                  <Route path="termos" element={<AdminTermos />} />
                  <Route path="configuracoes" element={<AdminConfiguracoes />} />
                  <Route path="configuracoes/plataforma" element={<AdminPlataforma />} />
                  <Route path="configuracoes/usuarios" element={<AdminConfiguracoes />} />
                  <Route path="configuracoes/bloco-padrao" element={<AdminBlocoPadrao />} />
                  <Route path="configuracoes/feedbacks" element={<AdminFeedbacks />} />
                  <Route path="configuracoes/migrados" element={<AdminMigrados />} />
                  <Route path="reposicoes" element={<AdminReposicoes />} />
                  <Route path="trocas" element={<AdminTrocas />} />
                  <Route path="gestao-bms" element={<AdminGestaoBMs />} />
                  <Route path="parceiros" element={<AdminParceiros />} />
                  <Route path="api" element={<AdminApi />} />
                  <Route path="anuncios" element={<AdminAnuncios />} />
                  <Route path="chat" element={<AdminTeamChat />} />
                  <Route path="fbx" element={<AdminFBX />} />
                  <Route path="aquecimento" element={<AdminAquecimento />} />
                  <Route path="esteira-admin" element={<AdminEsteiraAdmin />} />
                  <Route path="fornecedor" element={<AdminShopClone />} />
                  <Route path="ferramentas-2fa" element={<AdminFerramentas2FA />} />
                  <Route path="imagens" element={<AdminImageViewer />} />
                </Route>

                {/* Protected routes */}
                {user ? (
                  <Route path="/*" element={<AuthenticatedApp user={user} onLogout={handleLogout} />} />
                ) : (
                  <Route path="*" element={<Navigate to="/auth" replace />} />
                )}
              </Routes>
              <FloatingCart />
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
