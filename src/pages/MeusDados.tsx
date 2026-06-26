import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Trash2, FileText, Shield, History, Loader2 } from "lucide-react";

export default function MeusDados() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [consents, setConsents] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);
      setUserEmail(user.email || "");
      const [c, r] = await Promise.all([
        supabase.from("consent_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("data_subject_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setConsents(c.data || []);
      setRequests(r.data || []);
    })();
  }, [navigate]);

  const exportData = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      const [profile, orders, items, subs, wallet, tickets, partner] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", userId),
        supabase.from("order_items").select("*, orders!inner(user_id)").eq("orders.user_id", userId),
        supabase.from("subscriptions").select("*").eq("user_id", userId),
        supabase.from("wallet_transactions").select("*").eq("user_id", userId),
        supabase.from("tickets").select("*").eq("user_id", userId),
        supabase.from("partners").select("*").eq("user_id", userId),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        user: { id: userId, email: userEmail },
        profile: profile.data,
        orders: orders.data,
        order_items: items.data,
        subscriptions: subs.data,
        wallet_transactions: wallet.data,
        tickets: tickets.data,
        partner: partner.data,
        consent_logs: consents,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fbflix-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await supabase.from("consent_logs").insert({
        user_id: userId, event_type: "data_export", user_agent: navigator.userAgent,
      });
      toast.success("Seus dados foram exportados");
    } catch (e: any) {
      toast.error("Erro ao exportar: " + (e.message || e));
    } finally { setExporting(false); }
  };

  const requestDeletion = async () => {
    if (!userId) return;
    if (!confirm("Tem certeza? Após análise (até 15 dias), sua conta e dados pessoais serão excluídos. Esta ação é irreversível.")) return;
    setRequesting(true);
    try {
      const { error } = await supabase.from("data_subject_requests").insert({
        user_id: userId, request_type: "deletion", status: "pending",
        details: "Solicitação de exclusão de conta via portal /meus-dados",
      });
      if (error) throw error;
      await supabase.from("consent_logs").insert({
        user_id: userId, event_type: "deletion_requested", user_agent: navigator.userAgent,
      });
      toast.success("Solicitação registrada. Nossa equipe entrará em contato em até 15 dias.");
      const { data } = await supabase.from("data_subject_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      setRequests(data || []);
    } catch (e: any) {
      toast.error("Erro: " + (e.message || e));
    } finally { setRequesting(false); }
  };

  const requestType = async (type: string, label: string) => {
    if (!userId) return;
    setRequesting(true);
    try {
      const { error } = await supabase.from("data_subject_requests").insert({
        user_id: userId, request_type: type, status: "pending",
        details: `Solicitação de ${label} via portal /meus-dados`,
      });
      if (error) throw error;
      toast.success("Solicitação registrada");
      const { data } = await supabase.from("data_subject_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      setRequests(data || []);
    } catch (e: any) { toast.error("Erro: " + (e.message || e)); }
    finally { setRequesting(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Shield className="size-7 text-primary" /> Meus Dados
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Conforme a <strong>LGPD (Lei nº 13.709/2018)</strong>, você tem o direito de acessar, exportar, corrigir e excluir seus dados pessoais a qualquer momento.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card icon={<Download className="size-5" />} title="Exportar meus dados" desc="Baixe um arquivo JSON com todas as suas informações (perfil, pedidos, transações).">
            <button onClick={exportData} disabled={exporting} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? "Exportando..." : "Baixar JSON"}
            </button>
          </Card>

          <Card icon={<FileText className="size-5" />} title="Corrigir dados" desc="Solicite correção de qualquer informação cadastral incorreta.">
            <button onClick={() => requestType("rectification", "correção de dados")} disabled={requesting} className="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 font-semibold text-sm">
              Solicitar correção
            </button>
          </Card>

          <Card icon={<Shield className="size-5" />} title="Anonimizar dados" desc="Solicite que dados desnecessários sejam anonimizados, mantendo apenas o necessário por lei.">
            <button onClick={() => requestType("anonymization", "anonimização")} disabled={requesting} className="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 font-semibold text-sm">
              Solicitar anonimização
            </button>
          </Card>

          <Card icon={<Trash2 className="size-5" />} title="Excluir minha conta" desc="Direito ao esquecimento. Dados serão excluídos em até 15 dias, exceto os exigidos por lei (fiscal, anti-fraude).">
            <button onClick={requestDeletion} disabled={requesting} className="w-full py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <Trash2 className="size-4" /> Solicitar exclusão
            </button>
          </Card>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border">
          <h2 className="font-bold text-foreground flex items-center gap-2 mb-3"><History className="size-4" /> Minhas solicitações</h2>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-secondary/50 border border-border">
                  <div>
                    <div className="font-semibold text-foreground capitalize">{r.request_type}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${r.status === "completed" ? "bg-green-500/20 text-green-400" : r.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {r.status === "pending" ? "Em análise" : r.status === "completed" ? "Concluída" : r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border">
          <h2 className="font-bold text-foreground flex items-center gap-2 mb-3"><History className="size-4" /> Histórico de consentimentos</h2>
          {consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro.</p>
          ) : (
            <div className="space-y-1.5 text-xs">
              {consents.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                  <span className="font-mono text-muted-foreground">{c.event_type}</span>
                  <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 text-sm">
          <p className="font-semibold text-foreground mb-1">Encarregado de Dados (DPO)</p>
          <p className="text-muted-foreground">Para reclamações ou dúvidas sobre o tratamento dos seus dados, entre em contato com nosso DPO: <span className="text-primary">equipefbflix@gmail.com</span></p>
          <p className="text-muted-foreground mt-2">Você também pode acionar a Autoridade Nacional de Proteção de Dados (ANPD) através do site <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer" className="text-primary underline">gov.br/anpd</a>.</p>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3">
      <div className="flex items-center gap-2 text-primary">{icon}<span className="font-bold text-foreground text-sm">{title}</span></div>
      <p className="text-xs text-muted-foreground flex-1">{desc}</p>
      {children}
    </div>
  );
}