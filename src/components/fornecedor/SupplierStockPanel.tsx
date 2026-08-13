import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, PackagePlus, Send, CheckCircle2, XCircle, Clock, ShoppingBag,
  DollarSign, Timer, Boxes, RefreshCw, UserRound, Briefcase, Flag,
} from "lucide-react";

type CallPortal = (action: string, payload?: Record<string, any>) => Promise<any>;

const TYPES = [
  { key: "perfil", label: "Perfil", icon: UserRound },
  { key: "bm", label: "Business Manager", icon: Briefcase },
  { key: "pagina", label: "Página", icon: Flag },
] as const;

type ItemType = (typeof TYPES)[number]["key"];

const emptyForm = {
  nomePerfil: "", idPerfil: "", linkPerfil: "", emailAcesso: "", senha: "",
  emailAlternativo: "", senhaEmail: "", token2fa: "", dataNascimento: "",
  genero: "masculino", tempoPlataforma: "3-meses", statusAtual: "aquecido",
  cookies: "", descricao: "", perfilMatriz: "", perfilBackup: "", linkDocumento: "", payout: "",
};

const statusBadge: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Em revisão", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock },
  approved: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  rejected: { label: "Recusado", cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

export function SupplierStockPanel({ callPortal }: { callPortal: CallPortal }) {
  const [tab, setTab] = useState<"novo" | "meus">("novo");
  const [type, setType] = useState<ItemType>("perfil");
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [filter, setFilter] = useState<string>("all");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(true);
    try {
      const data = await callPortal("list-submissions");
      setSubmissions(data?.submissions || []);
      setMetrics(data?.metrics || null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar itens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    const name =
      type === "perfil" ? form.nomePerfil.trim()
      : type === "bm" ? form.nomePerfil.trim()
      : form.nomePerfil.trim();

    if (!name) return toast.error("Informe o nome do item");
    if (type === "perfil" && !form.linkPerfil && !form.idPerfil) {
      return toast.error("Informe o link ou o ID do perfil");
    }
    if (type !== "perfil" && !form.linkPerfil) {
      return toast.error("Informe o link");
    }

    setSaving(true);
    try {
      await callPortal("submit-stock-item", {
        type,
        name,
        identification: form.idPerfil || null,
        identification_link: form.linkPerfil || null,
        payout_amount: form.payout ? parseFloat(form.payout) : 0,
        data: {
          nomePerfil: form.nomePerfil,
          emailAcesso: form.emailAcesso,
          senha: form.senha,
          emailAlternativo: form.emailAlternativo,
          senhaEmail: form.senhaEmail,
          token2fa: form.token2fa,
          dataNascimento: form.dataNascimento,
          genero: form.genero,
          tempoPlataforma: form.tempoPlataforma,
          statusAtual: form.statusAtual,
          cookies: form.cookies,
          descricao: form.descricao,
          perfilMatriz: form.perfilMatriz,
          perfilBackup: form.perfilBackup,
          linkDocumento: form.linkDocumento,
        },
      });
      toast.success("Item enviado para revisão!");
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar item");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return submissions;
    if (filter === "loja") return submissions.filter((s) => s.status === "approved" && s.stock_item?.status !== "vendido");
    if (filter === "vendido") return submissions.filter((s) => s.sold_at || s.stock_item?.status === "vendido");
    return submissions.filter((s) => s.status === filter);
  }, [submissions, filter]);

  const field = (label: string, k: string, placeholder?: string, t = "text") => (
    <div key={k} className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</label>
      <Input
        type={t}
        value={(form as any)[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className="bg-black/30 border-white/5 text-white h-10"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Send} label="Enviados" value={metrics?.sent ?? 0}
          sub={`${metrics?.approvalRate ?? 0}% aprovados`} color="text-sky-400" />
        <MetricCard icon={Boxes} label="Em estoque" value={metrics?.inStock ?? 0}
          sub={`${metrics?.pending ?? 0} em revisão`} color="text-amber-400" />
        <MetricCard icon={ShoppingBag} label="Vendidos" value={metrics?.sold ?? 0}
          sub={`${metrics?.rejected ?? 0} recusados`} color="text-emerald-400" />
        <MetricCard icon={DollarSign} label="A receber"
          value={`R$ ${Number(metrics?.totalDue ?? 0).toFixed(2)}`}
          sub={`Pago: R$ ${Number(metrics?.totalPaid ?? 0).toFixed(2)}`} color="text-primary" />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <Timer className="h-3.5 w-3.5" />
        Tempo médio de venda: <span className="text-white font-semibold">{metrics?.avgDaysToSell ?? 0} dias</span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-black/40 border border-zinc-800/50 h-10 p-1">
          <TabsTrigger value="novo" className="data-[state=active]:bg-zinc-800 text-xs font-bold uppercase tracking-wider px-4">
            <PackagePlus className="h-4 w-4 mr-2" /> Cadastrar item
          </TabsTrigger>
          <TabsTrigger value="meus" className="data-[state=active]:bg-zinc-800 text-xs font-bold uppercase tracking-wider px-4">
            <Boxes className="h-4 w-4 mr-2" /> Meus itens na loja
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "novo" && (
        <div className="rounded-2xl border border-zinc-800/60 bg-black/30 p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = type === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`rounded-xl border p-4 flex flex-col items-center gap-2 transition-all ${
                    active ? "border-primary/50 bg-primary/10" : "border-zinc-800/60 bg-black/20 hover:border-zinc-700"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-zinc-500"}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${active ? "text-white" : "text-zinc-500"}`}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field(type === "bm" ? "Nome da BM" : type === "pagina" ? "Nome da página" : "Nome do perfil", "nomePerfil", "Ex: João Silva")}
            {field(type === "perfil" ? "Link do perfil" : "Link", "linkPerfil", "https://facebook.com/...")}

            {type === "perfil" && (
              <>
                {field("ID do perfil", "idPerfil", "1000123456789")}
                {field("Login / E-mail", "emailAcesso", "email@dominio.com")}
                {field("Senha do Facebook", "senha", "Senha FB")}
                {field("E-mail alternativo", "emailAlternativo", "alternativo@dominio.com")}
                {field("Senha do e-mail", "senhaEmail", "Senha do e-mail")}
                {field("Token 2FA", "token2fa", "Chave 2FA")}
                {field("Data de nascimento", "dataNascimento", "01/01/1990")}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Gênero</label>
                  <select value={form.genero} onChange={(e) => set("genero", e.target.value)}
                    className="w-full h-10 rounded-md bg-black/30 border border-white/5 text-white text-sm px-3">
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Tempo de plataforma</label>
                  <select value={form.tempoPlataforma} onChange={(e) => set("tempoPlataforma", e.target.value)}
                    className="w-full h-10 rounded-md bg-black/30 border border-white/5 text-white text-sm px-3">
                    <option value="1-mes">1 mês</option>
                    <option value="3-meses">3 meses</option>
                    <option value="6-meses">6 meses</option>
                    <option value="1-ano">1 ano+</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Status atual</label>
                  <select value={form.statusAtual} onChange={(e) => set("statusAtual", e.target.value)}
                    className="w-full h-10 rounded-md bg-black/30 border border-white/5 text-white text-sm px-3">
                    <option value="aquecido">Aquecido</option>
                    <option value="novo">Novo</option>
                    <option value="verificado">Verificado</option>
                  </select>
                </div>
              </>
            )}

            {type === "bm" && (
              <>
                {field("Perfil matriz (link)", "perfilMatriz", "Perfil que administra a BM")}
                {field("Perfil backup admin", "perfilBackup", "Nome ou link do perfil backup")}
              </>
            )}

            {type === "pagina" && field("Link do documento (opcional)", "linkDocumento", "https://drive.google.com/...")}

            {field("Valor combinado (R$)", "payout", "0,00")}
          </div>

          {type === "perfil" && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Cookies</label>
              <Textarea value={form.cookies} onChange={(e) => set("cookies", e.target.value)}
                placeholder="Cole os cookies aqui (opcional)"
                className="bg-black/30 border-white/5 text-white min-h-[90px] font-mono text-xs" />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Observações</label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)}
              placeholder="Detalhes relevantes do item"
              className="bg-black/30 border-white/5 text-white min-h-[70px]" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setForm({ ...emptyForm })}>Limpar</Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para revisão
            </Button>
          </div>
        </div>
      )}

      {tab === "meus" && (
        <div className="rounded-2xl border border-zinc-800/60 bg-black/30 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {[
                { k: "all", l: "Todos" },
                { k: "pending", l: "Em revisão" },
                { k: "loja", l: "Na loja" },
                { k: "vendido", l: "Vendidos" },
                { k: "rejected", l: "Recusados" },
              ].map((f) => (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all ${
                    filter === f.k ? "border-primary/50 bg-primary/10 text-white" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}>
                  {f.l}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={load} className="gap-2 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">Nenhum item nesta visão.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => {
                const badge = statusBadge[s.status] || statusBadge.pending;
                const BIcon = badge.icon;
                const sold = s.sold_at || s.stock_item?.status === "vendido";
                return (
                  <div key={s.id} className="rounded-xl border border-zinc-800/60 bg-black/20 p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                        <Badge variant="outline" className="text-[9px] uppercase border-zinc-700 text-zinc-400">{s.type}</Badge>
                        <Badge variant="outline" className={`text-[9px] uppercase ${badge.cls}`}>
                          <BIcon className="h-3 w-3 mr-1" />{badge.label}
                        </Badge>
                        {sold && (
                          <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-400 border-blue-500/20">Vendido</Badge>
                        )}
                        {s.paid_at && (
                          <Badge variant="outline" className="text-[9px] uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Pago</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 truncate">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        {s.product ? ` • Na loja como "${s.product.name}" — R$ ${Number(s.product.price).toFixed(2)}` : ""}
                      </p>
                      {s.status === "rejected" && s.reject_reason && (
                        <p className="text-[11px] text-red-400 mt-1">Motivo: {s.reject_reason}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">R$ {Number(s.payout_amount || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-zinc-500">{s.paid_at ? "recebido" : "a receber"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-black/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>
    </div>
  );
}