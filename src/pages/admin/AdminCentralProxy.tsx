import { Globe, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebshareProxyTab from "@/components/admin/proxy/WebshareProxyTab";
import ProxyMaintenanceTab from "@/components/admin/proxy/ProxyMaintenanceTab";

export default function AdminCentralProxy() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
          <Globe className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Proxy Fbflix</h1>
          <p className="text-xs text-muted-foreground">Gestão de proxies do fornecedor Fbflix</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="bg-card/60 border border-border/40">
          <TabsTrigger value="dashboard">
            <Globe className="size-4 mr-1.5" />Dashboard
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Wrench className="size-4 mr-1.5" />Manutenção
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <WebshareProxyTab />
        </TabsContent>

        <TabsContent value="maintenance">
          <ProxyMaintenanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
