import { Globe } from "lucide-react";
import WebshareProxyTab from "@/components/admin/proxy/WebshareProxyTab";

export default function AdminCentralProxy() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
          <Globe className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Proxy WebShare</h1>
          <p className="text-xs text-muted-foreground">Gestão de proxies do fornecedor Webshare</p>
        </div>
      </div>

      <WebshareProxyTab />
    </div>
  );
}
