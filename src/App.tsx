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
import AdminTeamChat from "./pages/admin/AdminTeamChat";
import AdminBlocoPadrao from "./pages/admin/AdminBlocoPadrao";
import AdminReciclagem from "./pages/admin/AdminReciclagem";
import AdminCentroCustos from "./pages/admin/AdminCentroCustos";
import AdminClientesAtivos from "./pages/admin/AdminClientesAtivos";
import AdminFeedbacks from "./pages/admin/AdminFeedbacks";
import AdminReposicoes from "./pages/admin/AdminReposicoes";
import AdminTrocas from "./pages/admin/AdminTrocas";
import AdminGestaoBMs from "./pages/admin/AdminGestaoBMs";
import AdminParceiros from "./pages/admin/AdminParceiros";
import PartnerRedirect from "./pages/PartnerRedirect";
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
        <Route path="/ganhe-aqui" element={<GanheAqui />} />
        <Route path="/como-funciona" element={<ComoFunciona />} />
        <Route path="/suporte" element={<Suporte />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/mercado" element={<Mercado />} />
        <Route path="/mercado/token-fbx" element={<TokenFBX />} />
        <Route path="/profile" element={<Profile />} />
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // On sign-in (including OAuth), check if user is admin/moderator and redirect
        if (event === 'SIGNED_IN' && session?.user) {
          // Prevent redirect loop: only redirect once per session
          const redirectKey = `staff_redirect_${session.user.id}`;
          if (sessionStorage.getItem(redirectKey)) return;

          // Don't redirect if user is already on admin or explicitly visiting client pages
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/admin') || currentPath === '/loja' || currentPath === '/profile' || currentPath === '/wallet' || currentPath.startsWith('/subscriptions') || currentPath.startsWith('/orders') || currentPath.startsWith('/item-details')) return;

          const userId = session.user.id;
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
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
                <Route path="/parceiro/:slug" element={<PartnerRedirect />} />

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
                  <Route path="pedidos" element={<AdminPedidos />} />
                  <Route path="pagamentos" element={<AdminPagamentos />} />
                  <Route path="carrinhos-abandonados" element={<AdminCarrinhosAbandonados />} />
                  <Route path="assinaturas" element={<AdminAssinaturas />} />
                  <Route path="central-proxy" element={<AdminCentralProxy />} />
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
                  <Route path="reposicoes" element={<AdminReposicoes />} />
                  <Route path="trocas" element={<AdminTrocas />} />
                  <Route path="gestao-bms" element={<AdminGestaoBMs />} />
                  <Route path="parceiros" element={<AdminParceiros />} />
                  <Route path="api" element={<AdminApi />} />
                  <Route path="anuncios" element={<AdminAnuncios />} />
                  <Route path="chat" element={<AdminTeamChat />} />
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
