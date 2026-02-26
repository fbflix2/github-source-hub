import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BellRing, Trash2, Loader2, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WaitlistEntry {
  id: string;
  user_id: string;
  product_id: string;
  status: string;
  created_at: string;
  product_name?: string;
  product_image?: string;
  product_stock?: number;
  client_name?: string;
  client_email?: string;
}

export function WaitlistTab() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      // Fetch waitlist entries
      const { data: waitlist, error } = await supabase
        .from("product_waitlist" as any)
        .select("*")
        .eq("status", "waiting")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!waitlist || waitlist.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const typedWaitlist = waitlist as any[];

      // Get unique product IDs and user IDs
      const productIds = [...new Set(typedWaitlist.map((w: any) => w.product_id))];
      const userIds = [...new Set(typedWaitlist.map((w: any) => w.user_id))];

      // Fetch products
      const { data: products } = await supabase
        .from("products")
        .select("id, name, image_url, stock")
        .in("id", productIds);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      // Fetch emails via edge function
      let emailMap: Record<string, string> = {};
      try {
        const { data: emailData } = await supabase.functions.invoke("list-user-emails", {
          body: { user_ids: userIds },
        });
        if (emailData?.users) {
          emailData.users.forEach((u: any) => {
            emailMap[u.id] = u.email;
          });
        }
      } catch { /* ignore */ }

      const productMap = new Map((products || []).map(p => [p.id, p]));
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const enriched: WaitlistEntry[] = typedWaitlist.map((w: any) => {
        const product = productMap.get(w.product_id);
        const profile = profileMap.get(w.user_id);
        return {
          ...w,
          product_name: product?.name || "Produto removido",
          product_image: product?.image_url,
          product_stock: product?.stock ?? 0,
          client_name: profile?.full_name || "Sem nome",
          client_email: emailMap[w.user_id] || "",
        };
      });

      setEntries(enriched);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar lista de espera");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const handleRemove = async (id: string) => {
    await supabase.from("product_waitlist" as any).delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success("Registro removido");
  };

  // Group by product
  const grouped = entries.reduce<Record<string, WaitlistEntry[]>>((acc, entry) => {
    const key = entry.product_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-12 text-center">
        <BellRing className="size-12 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Nenhum cliente na lista de espera</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} cliente{entries.length !== 1 ? "s" : ""} aguardando {Object.keys(grouped).length} produto{Object.keys(grouped).length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={fetchWaitlist}>
          Atualizar
        </Button>
      </div>

      {Object.entries(grouped).map(([productId, items]) => {
        const first = items[0];
        const inStock = (first.product_stock ?? 0) > 0;

        return (
          <div key={productId} className="glass-panel rounded-xl overflow-hidden">
            {/* Product header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
              {first.product_image ? (
                <img src={first.product_image} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">{first.product_name}</h3>
                <p className="text-xs text-muted-foreground">{items.length} interessado{items.length !== 1 ? "s" : ""}</p>
              </div>
              {inStock ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Em estoque ({first.product_stock})</Badge>
              ) : (
                <Badge variant="destructive">Sem estoque</Badge>
              )}
            </div>

            {/* Clients table */}
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">E-mail</TableHead>
                  <TableHead className="text-muted-foreground">Solicitado em</TableHead>
                  <TableHead className="text-muted-foreground w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(entry => (
                  <TableRow key={entry.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="size-3.5 text-primary" />
                        </div>
                        <span className="text-sm text-foreground">{entry.client_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.client_email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(entry.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
