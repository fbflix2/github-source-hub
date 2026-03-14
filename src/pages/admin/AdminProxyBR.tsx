import { Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProxyCostManagement from "@/components/admin/proxy/ProxyCostManagement";
import ProxyFinancialOverview from "@/components/admin/proxy/ProxyFinancialOverview";
import ProxyUnlinkedList from "@/components/admin/proxy/ProxyUnlinkedList";

export default function AdminProxyBR() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
          <Globe className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">ProxyBR</h1>
          <p className="text-xs text-muted-foreground">Gestão de proxies, custos e finanças do fornecedor ProxyBR</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="costs" className="space-y-6">
        <TabsList className="bg-card/60 border border-border/40">
          <TabsTrigger value="costs">Custos & Estoque</TabsTrigger>
          <TabsTrigger value="financial">Balanço Financeiro</TabsTrigger>
          <TabsTrigger value="unlinked">Sem Cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="costs">
          <ProxyCostManagement />
        </TabsContent>

        <TabsContent value="financial">
          <ProxyFinancialOverview />
        </TabsContent>

        <TabsContent value="unlinked">
          <ProxyUnlinkedList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
