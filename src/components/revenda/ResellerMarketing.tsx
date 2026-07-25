import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Download, ImageIcon, Loader2, Megaphone, Sparkles } from "lucide-react";

interface Creative {
  id: string;
  title: string;
  description: string | null;
  type: string;
  media_url: string | null;
  copy_text: string | null;
  created_at: string;
}

export default function ResellerMarketing() {
  const [items, setItems] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("partner_creatives" as any)
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="size-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Megaphone className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Marketing
            <Sparkles className="size-5 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Criativos em imagem e copys prontas para você divulgar sua loja e vender mais.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card/60 border border-border rounded-xl p-10 text-center">
          <ImageIcon className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Em breve nossa biblioteca de criativos e copys estará disponível aqui.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((cr) => (
            <div
              key={cr.id}
              className="bg-card/70 border border-border rounded-xl overflow-hidden flex flex-col"
            >
              {cr.media_url && (
                <div className="w-full bg-black/30 flex items-center justify-center">
                  <img
                    src={cr.media_url}
                    alt={cr.title}
                    className="w-full h-auto object-contain max-h-64"
                  />
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <p className="font-bold text-foreground text-sm">{cr.title}</p>
                {cr.description && (
                  <p className="text-xs text-muted-foreground mt-1">{cr.description}</p>
                )}
                {cr.copy_text && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
                      Copy
                    </p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap bg-muted/40 border border-border rounded p-2 max-h-40 overflow-auto">
                      {cr.copy_text}
                    </p>
                    <button
                      onClick={() => copy(cr.copy_text!)}
                      className="mt-2 inline-flex items-center gap-1 text-primary text-xs font-bold uppercase"
                    >
                      <Copy className="size-3" /> Copiar
                    </button>
                  </div>
                )}
                {cr.media_url && (
                  <a
                    href={cr.media_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="mt-3 inline-flex items-center gap-1 text-primary text-xs font-bold uppercase"
                  >
                    <Download className="size-3" /> Baixar mídia
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}