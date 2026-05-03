import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Code2, Shield, Globe, Zap, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ApiDocs() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(null), 2000);
  };

  const CodeBlock = ({ code, id, language = "json" }: { code: string; id: string; language?: string }) => (
    <div className="relative group mt-2">
      <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-xs font-mono text-slate-300 border border-white/10">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-white hover:bg-white/10"
        onClick={() => copyToClipboard(code, id)}
      >
        {copied === id ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );

  return (
    <div className="container max-w-5xl py-8 animate-fade-in space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
            <Code2 className="text-primary size-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Documentação da API ProxyFbflix</h1>
            <p className="text-muted-foreground">Integre nossa infraestrutura de proxies diretamente no seu sistema.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 space-y-8 border-none bg-transparent shadow-none">
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              1. Autenticação
            </h2>
            <p className="text-sm text-muted-foreground">
              Todas as requisições para a API devem incluir o cabeçalho <code className="bg-muted px-1.5 py-0.5 rounded text-primary">Authorization</code> com um token JWT válido.
            </p>
            <CodeBlock 
              id="auth"
              language="http"
              code="Authorization: Bearer <SEU_TOKEN_DE_ACESSO>"
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              2. Endpoint Base
            </h2>
            <p className="text-sm text-muted-foreground">
              Nossa API é hospedada no Supabase Edge Functions. O método padrão é <Badge variant="secondary">POST</Badge>.
            </p>
            <CodeBlock 
              id="base-url"
              code="https://[SUA_URL_PLATAFORMA].supabase.co/functions/v1/proxyfbflix-api"
            />
          </section>

          <Tabs defaultValue="purchase" className="w-full">
            <TabsList className="w-full justify-start bg-muted/50 p-1 mb-4">
              <TabsTrigger value="purchase">Comprar Proxy</TabsTrigger>
              <TabsTrigger value="list">Listar Meus Proxies</TabsTrigger>
              <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="purchase" className="space-y-4 mt-0">
              <div className="space-y-2">
                <h3 className="font-bold flex items-center gap-2">
                  <Zap className="size-4 text-yellow-500" />
                  Comprar via Saldo
                </h3>
                <p className="text-sm text-muted-foreground">Adquira proxies programaticamente debitando do saldo da sua conta.</p>
              </div>
              <CodeBlock 
                id="req-purchase"
                code={JSON.stringify({
  action: "purchase-proxy-with-balance",
  total: 9.90,
  product_id: "UUID-DO-PRODUTO",
  order_id: "PEDIDO-INTERNO-123",
  quantity: 1
}, null, 2)}
              />
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-4">Resposta de Sucesso</p>
              <CodeBlock 
                id="res-purchase"
                code={JSON.stringify({
  success: true,
  quantity: 1,
  subscriptions: ["WS-ABCD123"],
  proxies: [
    {
      ip: "185.242.x.x",
      port: 8080,
      username: "user123",
      password: "pass_secure"
    }
  ]
}, null, 2)}
              />
            </TabsContent>

            <TabsContent value="list" className="space-y-4 mt-0">
              <h3 className="font-bold">Listar Proxies Ativos</h3>
              <CodeBlock 
                id="req-list"
                code={JSON.stringify({
  action: "get-proxy-list",
  page: 1,
  page_size: 100
}, null, 2)}
              />
            </TabsContent>

            <TabsContent value="stats" className="space-y-4 mt-0">
              <h3 className="font-bold">Consumo de Banda</h3>
              <CodeBlock 
                id="req-stats"
                code={JSON.stringify({
  action: "get-bandwidth-stats"
}, null, 2)}
              />
            </TabsContent>
          </Tabs>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="size-4" />
                Dica Rápida
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3">
              <p>
                Para obter o <code className="bg-primary/10 text-primary px-1">product_id</code>, verifique a URL do produto na loja ou consulte via API de catálogo.
              </p>
              <p>
                As credenciais retornadas são padrão **HTTP/SOCKS5**.
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-sm text-red-400">Erros Comuns</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] space-y-2 font-mono">
              <div className="p-2 bg-black/20 rounded border border-red-500/10 text-red-200">
                "Saldo insuficiente"
              </div>
              <div className="p-2 bg-black/20 rounded border border-red-500/10 text-red-200">
                "Nenhum proxy disponível"
              </div>
              <div className="p-2 bg-black/20 rounded border border-red-500/10 text-red-200">
                "Token inválido"
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
