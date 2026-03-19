import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

interface SecurityMonitorProps {
  bmNames: string[];
}

const GENERIC_ACTIONS = [
  { icon: "shield", template: (bm: string) => `Verificando possíveis scans na ${bm}...` },
  { icon: "lock", template: (bm: string) => `Ativando camada de segurança anti-phishing na ${bm}...` },
  { icon: "enhanced_encryption", template: (bm: string) => `Criptografando link de convite da ${bm} para evitar vazamentos...` },
  { icon: "verified_user", template: (bm: string) => `Auditando permissões de usuários na ${bm}...` },
  { icon: "policy", template: (bm: string) => `Monitorando tentativas de acesso não autorizado na ${bm}...` },
  { icon: "security", template: (bm: string) => `Validando integridade dos pixels da ${bm}...` },
  { icon: "vpn_lock", template: (bm: string) => `Escaneando endpoints de API da ${bm}...` },
  { icon: "fingerprint", template: (bm: string) => `Verificando autenticação de dois fatores na ${bm}...` },
  { icon: "gpp_good", template: (bm: string) => `Proteção anti-clone ativa na ${bm}...` },
  { icon: "visibility_off", template: (bm: string) => `Ocultando dados sensíveis de campanhas na ${bm}...` },
  { icon: "sync_lock", template: (bm: string) => `Sincronizando backup criptografado da ${bm}...` },
  { icon: "admin_panel_settings", template: (bm: string) => `Revisando configurações de segurança da ${bm}...` },
  { icon: "dns", template: (bm: string) => `Verificando integridade DNS da ${bm}...` },
  { icon: "health_and_safety", template: (bm: string) => `Scan de saúde completo iniciado na ${bm}...` },
];

export interface LogEntry {
  id: number;
  icon: string;
  text: string;
  status: "running" | "done";
  bmName: string;
}

export interface SecurityMonitorHandle {
  pushLog: (log: LogEntry) => void;
}

const SecurityMonitor = forwardRef<SecurityMonitorHandle, SecurityMonitorProps>(({ bmNames }, ref) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [counter, setCounter] = useState(0);

  const names = bmNames.length > 0 ? bmNames : ["BM Principal"];

  const generateLog = useCallback(() => {
    const action = GENERIC_ACTIONS[Math.floor(Math.random() * GENERIC_ACTIONS.length)];
    const bm = names[Math.floor(Math.random() * names.length)];
    const id = Date.now() + Math.random();
    return { id, icon: action.icon, text: action.template(bm), status: "running" as const, bmName: bm };
  }, [names]);

  useImperativeHandle(ref, () => ({
    pushLog: (log: LogEntry) => {
      setLogs(prev => [...prev, log].slice(-4));
      setCounter(c => c + 1);
    },
  }));

  useEffect(() => {
    setLogs([generateLog(), generateLog()]);
    setCounter(2);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(prev => {
        const updated = prev.map(l => l.status === "running" && Math.random() > 0.5 ? { ...l, status: "done" as const } : l);
        const newLog = generateLog();
        const result = [...updated, newLog].slice(-4);
        return result;
      });
      setCounter(c => c + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [generateLog]);

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0a0e13] to-[#1c2025] border border-emerald-500/20 p-4 flex flex-col justify-between overflow-hidden relative">
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <span className="material-symbols-outlined text-emerald-400 !text-xl animate-spin" style={{ animationDuration: "4s" }}>radar</span>
            <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" style={{ animationDuration: "2s" }} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Vigilância em Tempo Real
            </h4>
            <p className="text-[9px] text-emerald-400/70 font-mono uppercase tracking-widest">
              {names.length} BM{names.length > 1 ? "s" : ""} monitorada{names.length > 1 ? "s" : ""} • {counter} verificações
            </p>
          </div>
        </div>

        <div className="space-y-1.5 max-h-[120px] overflow-hidden">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 py-1 px-2 rounded-lg bg-white/[0.03] border border-white/[0.04] animate-fade-in"
            >
              <MaterialIcon
                name={log.status === "done" ? "check_circle" : log.icon}
                className={`!text-[14px] mt-0.5 ${log.status === "done" ? "text-emerald-400" : "text-[#ffb4aa] animate-pulse"}`}
              />
              <p className="text-[10px] text-[#c6c6c7]/80 leading-snug flex-1">
                {log.text.split(log.bmName).map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && <span className="text-emerald-400 font-bold">{log.bmName}</span>}
                  </span>
                ))}
              </p>
              <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${log.status === "done" ? "text-emerald-400" : "text-[#ffb4aa]"}`}>
                {log.status === "done" ? "OK" : "..."}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SecurityMonitor.displayName = "SecurityMonitor";
export default SecurityMonitor;
