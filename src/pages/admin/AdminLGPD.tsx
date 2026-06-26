import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, FileText, AlertTriangle, CheckCircle2, Clock, Mail } from "lucide-react";

interface DSR {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  details: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  export: "Exportar dados",
  rectify: "Retificar dados",
  anonymize: "Anonimizar dados",
  delete: "Excluir conta",
  revoke_consent: "Revogar consentimento",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  completed: "bg-green-500/20 text-green-400 border-green-500/40",
  rejected: "bg-red-500/20 text-red-400 border-red-500/40",
};

export default function AdminLGPD() {
  const [requests, setRequests] = useState<DSR[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DSR | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("data_subject_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data || []) as DSR[];
    setRequests(list);

    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => {
        map[p.user_id] = { full_name: p.full_name, email: p.email };
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("dsr-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "data_subject_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("data_subject_requests")
      .update({
        status,
        processed_at: new Date().toISOString(),
        processed_by: u.user?.id,
        details: adminNote ? `${selected?.details || ""}\n\n[Admin]: ${adminNote}` : selected?.details,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Solicitação atualizada");
    setSelected(null);
    setAdminNote("");
    load();
  };

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    processing: requests.filter((r) => r.status === "processing").length,
    completed: requests.filter((r) => r.status === "completed").length,
    total: requests.length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Painel LGPD</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de solicitações de titulares de dados (Art. 18 LGPD) — DPO:{" "}
            <span className="text-primary">equipefbflix@gmail.com</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-400" /><span className="text-sm">Pendentes</span></div><p className="text-2xl font-bold mt-2">{counts.pending}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-blue-400" /><span className="text-sm">Em análise</span></div><p className="text-2xl font-bold mt-2">{counts.processing}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-sm">Concluídas</span></div><p className="text-2xl font-bold mt-2">{counts.completed}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span className="text-sm">Total</span></div><p className="text-2xl font-bold mt-2">{counts.total}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="ripd">RIPD</TabsTrigger>
          <TabsTrigger value="incident">Resposta a Incidentes</TabsTrigger>
          <TabsTrigger value="dpo">DPO</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-3 mt-4">
          {loading && <p className="text-muted-foreground">Carregando...</p>}
          {!loading && requests.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma solicitação registrada.</CardContent></Card>
          )}
          {requests.map((r) => {
            const p = profiles[r.user_id];
            const deadline = new Date(new Date(r.created_at).getTime() + 15 * 24 * 60 * 60 * 1000);
            const overdue = r.status === "pending" && deadline < new Date();
            return (
              <Card key={r.id} className={overdue ? "border-red-500/50" : ""}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{TYPE_LABEL[r.request_type] || r.request_type}</span>
                      <Badge variant="outline" className={STATUS_COLOR[r.status] || ""}>{r.status}</Badge>
                      {overdue && <Badge variant="destructive">Vencida (15 dias)</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {p?.full_name || "Usuário"} — {p?.email || r.user_id.slice(0, 8)}
                    </p>
                    {r.details && <p className="text-xs mt-2 whitespace-pre-wrap text-muted-foreground">{r.details}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      Aberta em {new Date(r.created_at).toLocaleString("pt-BR")} · Prazo até {deadline.toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelected(r); setAdminNote(""); }}>Processar</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="ripd" className="mt-4">
          <Card>
            <CardHeader><CardTitle>RIPD — Relatório de Impacto à Proteção de Dados</CardTitle></CardHeader>
            <CardContent className="prose prose-invert max-w-none text-sm space-y-4">
              <p><strong>Controlador:</strong> FBFlix · <strong>DPO:</strong> equipefbflix@gmail.com · <strong>Versão:</strong> 1.0 (26/06/2026)</p>

              <h3 className="text-base font-semibold">1. Natureza do tratamento</h3>
              <p>Operação de marketplace digital com venda de perfis, BMs, proxies e serviços correlatos. Coleta de cadastro, dados de pagamento (via gateway), comunicação WhatsApp e dados de uso da plataforma.</p>

              <h3 className="text-base font-semibold">2. Finalidades</h3>
              <ul className="list-disc pl-5">
                <li>Execução de contrato de compra e venda (Art. 7º, V)</li>
                <li>Cumprimento de obrigações legais e fiscais (Art. 7º, II)</li>
                <li>Prevenção a fraudes e segurança (Art. 7º, IX — legítimo interesse)</li>
                <li>Marketing direto a clientes (Art. 7º, IX / consentimento revogável)</li>
              </ul>

              <h3 className="text-base font-semibold">3. Categorias de dados tratados</h3>
              <ul className="list-disc pl-5">
                <li>Identificação: nome, CPF (mascarado em telas), data nascimento</li>
                <li>Contato: e-mail, telefone (WhatsApp)</li>
                <li>Financeiros: token de pagamento (não armazenamos PAN/CVV)</li>
                <li>Comportamentais: pedidos, navegação, logs de acesso</li>
              </ul>

              <h3 className="text-base font-semibold">4. Compartilhamentos e operadores</h3>
              <p>Supabase (hosting/DB), MercadoPago (pagamento), OpenPix (PIX), W-API (WhatsApp), Webshare (proxies). Todos contratualmente sujeitos a confidencialidade.</p>

              <h3 className="text-base font-semibold">5. Medidas de segurança</h3>
              <ul className="list-disc pl-5">
                <li>RLS em todas as tabelas; service_role apenas em edge functions</li>
                <li>Criptografia de credenciais (pgp_sym_encrypt)</li>
                <li>CPF mascarado nas telas; logs de acesso a credenciais sensíveis</li>
                <li>HTTPS obrigatório; tokens JWT; 2FA disponível para admin</li>
                <li>Validação de uploads por magic bytes (bloqueio SVG/HTML/script)</li>
              </ul>

              <h3 className="text-base font-semibold">6. Riscos identificados e mitigações</h3>
              <ul className="list-disc pl-5">
                <li><strong>Vazamento de credenciais de perfis vendidos:</strong> mitigado por compromised_stock_logic + reset automático.</li>
                <li><strong>Acesso não autorizado por staff:</strong> mitigado por moderator_permissions granulares + auditoria.</li>
                <li><strong>Exposição via Edge Functions:</strong> mitigado por verify_jwt e getClaims().</li>
                <li><strong>Retenção excessiva:</strong> mitigada pela tela MeusDados (exclusão sob demanda) e política de retenção.</li>
              </ul>

              <h3 className="text-base font-semibold">7. Retenção</h3>
              <p>Cadastro: enquanto a conta estiver ativa. Pedidos/fiscais: 5 anos. Logs de consentimento: 5 anos. Após período, dados são anonimizados.</p>

              <h3 className="text-base font-semibold">8. Direitos dos titulares</h3>
              <p>Atendidos via <code>/meus-dados</code> e e-mail do DPO. Prazo legal de resposta: 15 dias.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incident" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Fluxo de Resposta a Incidentes de Segurança</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-4">
              <div>
                <h3 className="font-semibold text-base">⏱️ Prazo crítico: notificar ANPD em até 72 horas</h3>
                <p className="text-muted-foreground">Art. 48 LGPD — comunicação ao titular e à ANPD em prazo razoável.</p>
              </div>

              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>T+0 — Detecção:</strong> qualquer membro da equipe que identificar incidente deve acionar o DPO imediatamente via WhatsApp interno + e-mail.</li>
                <li><strong>T+2h — Contenção:</strong> revogar tokens comprometidos, bloquear contas afetadas, rotacionar secrets (Supabase, MercadoPago, OpenPix, WAPI, Webshare).</li>
                <li><strong>T+12h — Investigação:</strong> revisar logs (Supabase, Edge Functions, audit trail), mapear titulares afetados e categorias de dados.</li>
                <li><strong>T+24h — Avaliação de risco:</strong> classificar gravidade (baixo/médio/alto) e impacto a direitos dos titulares.</li>
                <li><strong>T+48h — Documentação interna:</strong> abrir registro do incidente neste painel (categoria de dados, nº de titulares, causa raiz, mitigação).</li>
                <li><strong>T+72h — Notificação ANPD:</strong> via canal oficial (<a className="text-primary underline" href="https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis" target="_blank" rel="noreferrer">comunicado de incidente</a>) se houver risco/dano relevante.</li>
                <li><strong>T+72h — Notificação aos titulares afetados:</strong> e-mail + WhatsApp explicando o incidente, dados envolvidos e medidas adotadas.</li>
                <li><strong>Pós-incidente:</strong> revisão de RIPD, atualização de controles, retrospectiva no time.</li>
              </ol>

              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
                <p className="font-semibold text-yellow-400">Conteúdo mínimo da notificação à ANPD</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Natureza dos dados afetados</li>
                  <li>Titulares envolvidos (categorias e quantidade aproximada)</li>
                  <li>Medidas técnicas e de segurança adotadas</li>
                  <li>Riscos relacionados ao incidente</li>
                  <li>Medidas adotadas para reverter ou mitigar efeitos</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dpo" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Encarregado de Proteção de Dados (DPO)</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">equipefbflix@gmail.com</p>
                  <p className="text-muted-foreground text-xs">Canal oficial para titulares de dados e ANPD</p>
                </div>
              </div>
              <p className="text-muted-foreground">
                Para alterar o e-mail do DPO, atualize aqui e também em: <code>src/pages/PrivacyPolicy.tsx</code>,{" "}
                <code>src/pages/CookiePolicy.tsx</code> e <code>src/pages/MeusDados.tsx</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processar solicitação</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p><strong>Tipo:</strong> {TYPE_LABEL[selected.request_type] || selected.request_type}</p>
              <p><strong>Titular:</strong> {profiles[selected.user_id]?.full_name} ({profiles[selected.user_id]?.email})</p>
              {selected.details && <p className="text-muted-foreground whitespace-pre-wrap"><strong>Detalhes:</strong> {selected.details}</p>}
              <Textarea
                placeholder="Nota interna do DPO sobre o atendimento..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                ⚠️ A execução técnica (export/exclusão/anonimização) é feita pelo próprio titular em /meus-dados. Aqui registramos análise e auditoria.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => selected && updateStatus(selected.id, "processing")}>Em análise</Button>
            <Button variant="destructive" onClick={() => selected && updateStatus(selected.id, "rejected")}>Rejeitar</Button>
            <Button onClick={() => selected && updateStatus(selected.id, "completed")}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}