import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Check, ListChecks, Globe, Search } from "lucide-react";
import { ProxySubscription } from "@/pages/Subscriptions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DownloadProxiesDialogProps {
  subscriptions: ProxySubscription[];
}

export default function DownloadProxiesDialog({ subscriptions }: DownloadProxiesDialogProps) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Filter subscriptions that have proxy information
  const proxySubs = subscriptions.filter(sub => sub.proxy && sub.proxy.ip);

  const filteredSubs = proxySubs.filter(sub => {
    const term = searchTerm.toLowerCase();
    return (
      (sub.name || "").toLowerCase().includes(term) ||
      (sub.code || "").toLowerCase().includes(term) ||
      (sub.proxy?.ip || "").includes(term)
    );
  });

  const toggleSelectAll = () => {
    if (selectedCodes.length === filteredSubs.length) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(filteredSubs.map(sub => sub.code));
    }
  };

  const toggleSelect = (code: string) => {
    setSelectedCodes(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code) 
        : [...prev, code]
    );
  };

  const handleDownload = (all: boolean = false) => {
    const targetSubs = all ? proxySubs : proxySubs.filter(sub => selectedCodes.includes(sub.code));
    
    if (targetSubs.length === 0) return;

    const content = targetSubs.map(sub => {
      const parts = [`${sub.proxy!.ip}:${sub.proxy!.port}`];
      if (sub.proxy!.username) parts.push(sub.proxy!.username);
      if (sub.proxy!.password) parts.push(sub.proxy!.password);
      return parts.join(':');
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proxies_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/60"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Baixar Lista</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] glass-panel border-glass-border p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ListChecks className="size-5 text-primary" />
            Baixar Lista de Proxies
          </DialogTitle>
          <DialogDescription>
            Selecione os proxies que deseja exportar para um arquivo .txt
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/30 border-glass-border h-10"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="select-all" 
                checked={selectedCodes.length === filteredSubs.length && filteredSubs.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label 
                htmlFor="select-all" 
                className="text-sm font-medium leading-none cursor-pointer text-text-secondary hover:text-foreground transition-colors"
              >
                Selecionar {searchTerm ? 'resultados da busca' : 'todos'}
              </label>
            </div>
            <Badge variant="secondary" className="text-[10px] font-bold">
              {selectedCodes.length} selecionados
            </Badge>
          </div>

          <ScrollArea className="h-[300px] pr-4 -mr-4">
            <div className="space-y-2 pb-4">
              {filteredSubs.length > 0 ? (
                filteredSubs.map((sub) => (
                  <div 
                    key={sub.code}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                      selectedCodes.includes(sub.code) 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'bg-muted/20 border-glass-border hover:bg-muted/40'
                    }`}
                    onClick={() => toggleSelect(sub.code)}
                  >
                    <Checkbox 
                      checked={selectedCodes.includes(sub.code)}
                      onCheckedChange={() => toggleSelect(sub.code)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-foreground truncate">
                          {sub.name || sub.code}
                        </p>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {sub.proxy?.ip}:{sub.proxy?.port}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-secondary truncate mt-0.5">
                        {sub.product_name}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Globe className="size-8 text-muted-foreground mb-2 opacity-20" />
                  <p className="text-sm text-muted-foreground">Nenhum proxy encontrado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-glass-border bg-muted/10">
          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              className="flex-1 font-bold border-glass-border"
              onClick={() => handleDownload(true)}
              disabled={proxySubs.length === 0}
            >
              Baixar Tudo ({proxySubs.length})
            </Button>
            <Button
              className="flex-1 font-bold shadow-glow"
              disabled={selectedCodes.length === 0}
              onClick={() => handleDownload(false)}
            >
              Baixar Selecionados
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
