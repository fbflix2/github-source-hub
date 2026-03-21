import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, ExternalLink, FileText, Plus, Search, Send, Clock, CheckCircle, XCircle, Eye, MessageCircle } from "lucide-react";
import InvoiceDetailModal from "@/components/admin/InvoiceDetailModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientOption {
  user_id: string;
  full_name: string | null;
  email?: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface InvoiceLink {
  id: string;
  code: string;
  client_name: string | null;
  client_email: string | null;
  product_name: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  qr_code: string | null;
  qr_code_base64: string | null;
  reference_date?: string;
}

export default function AdminCobrancaAvulsa() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceLink[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [filteredClients, setFilteredClients] = useState<ClientOption[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceLink | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Filter clients as user types — debounced search directly from DB for accuracy
  useEffect(() => {
    if (clientSearch.length < 2) {
      setShowClientDropdown(false);
      setFilteredClients([]);
      return;
    }

    const searchLower = clientSearch.toLowerCase();
    const timer = setTimeout(async () => {
      // Auto-select if exact email match
      if (searchLower.includes("@")) {
        const exactMatch = clients.find(c => (c.email || "").toLowerCase() === searchLower);
        if (exactMatch) {
          setSelectedClient(exactMatch);
          setClientSearch("");
          setShowClientDropdown(false);
          setFilteredClients([]);
          return;
        }
      }

      // Search by name in profiles
      const { data: byName } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("full_name", `%${clientSearch}%`)
        .limit(15);

      const results: ClientOption[] = (byName || []).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: clients.find(c => c.user_id === p.user_id)?.email || "",
      }));

      // Also check cached emails
      const emailMatches = clients.filter(c =>
        (c.email || "").toLowerCase().includes(searchLower) &&
        !results.some(r => r.user_id === c.user_id)
      ).slice(0, 5);

      const combined = [...results, ...emailMatches].slice(0, 10);
      setFilteredClients(combined);
      setShowClientDropdown(combined.length > 0);
    }, 300);

    return () => clearTimeout(timer);
  }, [clientSearch, clients]);

  const loadData = async () => {
    // Load clients with emails
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .order("full_name");

    if (profilesData) {
      // Get emails via edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const res = await supabase.functions.invoke("list-user-emails", {
            body: { user_ids: profilesData.map(p => p.user_id) }
          });
          const emailMap: Record<string, string> = res.data?.emails || {};

          setClients(profilesData.map(p => ({
            ...p,
            email: emailMap[p.user_id] || ""
          })));
        } catch {
          setClients(profilesData.map(p => ({ ...p, email: "" })));
        }
      }
    }

    // Load products
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, price")
      .eq("status", "active")
      .order("name");

    // Load CT plans (Contingência Total)
    const { data: ctPlans } = await supabase
      .from("ct_plans")
      .select("id, name, price, tier")
      .eq("active", true)
      .order("name");

    const allProducts: ProductOption[] = [
      ...(productsData || []),
      ...(ctPlans || []).map(p => ({
        id: `ct_${p.id}`,
        name: `Contingência ${p.tier?.toUpperCase() || ''} — ${p.name}`,
        price: p.price,
      })),
    ];
    setProducts(allProducts);

    // Load invoices
    const { data: invoicesData, error: invError } = await supabase
      .from("invoice_links" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    console.log("Invoice load result:", { count: invoicesData?.length, error: invError });
    if (invoicesData) setInvoices(invoicesData as any);
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    if (productId === "custom") {
      setProductName("");
      setAmount("");
      return;
    }
    const product = products.find(p => p.id === productId);
    if (product) {
      setProductName(product.name);
      setAmount(product.price.toString());
    }
  };

  const handleSubmit = async () => {
    let resolvedClient = selectedClient;

    if (!resolvedClient && clientSearch.trim()) {
      const searchValue = clientSearch.trim();
      const searchLower = searchValue.toLowerCase();

      resolvedClient = clients.find((client) => {
        const email = (client.email || "").toLowerCase();
        const fullName = (client.full_name || "").toLowerCase();
        return email === searchLower || fullName === searchLower;
      }) || null;

      if (!resolvedClient && searchLower.includes("@")) {
        const { data: userId } = await supabase.rpc("get_user_id_by_email", {
          target_email: searchLower,
        });

        if (userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .eq("user_id", userId)
            .maybeSingle();

          if (profile) {
            resolvedClient = {
              user_id: profile.user_id,
              full_name: profile.full_name,
              email: searchValue,
            };
            setSelectedClient(resolvedClient);
          }
        }
      }
    }

    if (!resolvedClient || !productName || !amount || Number(amount) < 1) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-invoice-link", {
        body: {
          client_user_id: resolvedClient.user_id,
          client_name: resolvedClient.full_name,
          client_email: resolvedClient.email,
          product_name: productName,
          product_id: selectedProductId !== "custom" && !selectedProductId.startsWith("ct_") ? selectedProductId : null,
          amount: Number(amount),
          reference_date: referenceDate,
          description,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Cobrança criada com sucesso!");
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar cobrança");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setClientSearch("");
    setSelectedProductId("");
    setProductName("");
    setAmount("");
    setReferenceDate(new Date().toISOString().split("T")[0]);
    setDescription("");
  };

  const getPublicLink = (code: string) => {
    // Use edge function URL for OG preview on WhatsApp/social
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "mxnlerkeygfvdnznoxld";
    return `https://${projectId}.supabase.co/functions/v1/invoice-og?code=${code}`;
  };

  const getDirectLink = (code: string) => {
    return `${window.location.origin}/pagar/${code}`;
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(getPublicLink(code));
    toast.success("Link copiado!");
  };

  const getStatusBadge = (inv: InvoiceLink) => {
    const now = new Date();
    const expires = new Date(inv.expires_at);
    if (inv.status === "paid") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="size-3 mr-1" />Pago</Badge>;
    if (inv.status === "expired" || expires < now) return <Badge variant="destructive"><XCircle className="size-3 mr-1" />Expirado</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="size-3 mr-1" />Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobrança Avulsa</h1>
          <p className="text-sm text-muted-foreground">Gere cobranças PIX personalizadas e envie para seus clientes</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="size-4" />
          Nova Cobrança
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="size-5" />
              Nova Cobrança Avulsa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client search */}
            <div className="relative">
              <Label>Cliente *</Label>
              {selectedClient ? (
                <div className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-muted">
                  <span className="text-sm font-medium">{selectedClient.full_name}</span>
                  <span className="text-xs text-muted-foreground">{selectedClient.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedClient(null); setClientSearch(""); }}>✕</Button>
                </div>
              ) : (
                <>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente por nome ou email..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {showClientDropdown && filteredClients.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredClients.map(c => (
                        <button
                          key={c.user_id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between"
                          onClick={() => { setSelectedClient(c); setShowClientDropdown(false); setClientSearch(""); }}
                        >
                          <span className="font-medium">{c.full_name || "Sem nome"}</span>
                          <span className="text-muted-foreground text-xs">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Product */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Produto/Serviço *</Label>
                <Select value={selectedProductId} onValueChange={handleProductChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">✏️ Personalizado</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — R$ {p.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProductId === "custom" && (
                <div>
                  <Label>Nome do serviço *</Label>
                  <Input
                    className="mt-1"
                    placeholder="Ex: Consultoria, Manutenção..."
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Amount and date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Data de referência</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                className="mt-1"
                placeholder="Detalhes adicionais sobre a cobrança..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                <Send className="size-4" />
                {loading ? "Gerando..." : "Gerar Cobrança PIX"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cobranças Geradas</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma cobrança gerada ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 px-2">Código</th>
                    <th className="py-2 px-2">Cliente</th>
                    <th className="py-2 px-2">Produto</th>
                    <th className="py-2 px-2">Valor</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Criado em</th>
                    <th className="py-2 px-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono text-xs">{inv.code}</td>
                      <td className="py-2 px-2">{inv.client_name || "—"}</td>
                      <td className="py-2 px-2">{inv.product_name}</td>
                      <td className="py-2 px-2 font-medium">R$ {Number(inv.amount).toFixed(2)}</td>
                      <td className="py-2 px-2">{getStatusBadge(inv)}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {format(new Date(inv.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(inv); setShowDetailModal(true); }} title="Ver detalhes">
                            <Eye className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => copyLink(inv.code)} title="Copiar link">
                            <Copy className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const msg = `Olá ${inv.client_name || ""}! 👋\n\nVocê tem uma cobrança pendente na *FBFLIX*:\n\n📦 *${inv.product_name}*\n💰 *R$ ${Number(inv.amount).toFixed(2)}*\n\n🔗 ${getPublicLink(inv.code)}\n\nQualquer dúvida, estamos à disposição! ✅`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                          }} title="Enviar WhatsApp">
                            <MessageCircle className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailModal
        invoice={selectedInvoice}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
      />
    </div>
  );
}
