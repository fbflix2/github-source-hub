import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "fb-backups";

export interface BackupCredFile {
  id: string;
  file_name: string;
  storage_path: string;
  fb_id?: string | null;
}

interface Parsed {
  id?: string;
  email?: string;
  emailAlt?: string;
  password?: string;
  emailPassword?: string;
  token2fa?: string;
  accessToken?: string;
  cookies?: string;
  userAgent?: string;
  birthday?: string;
  name?: string;
  extras: { label: string; value: string }[];
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function parseCredentials(text: string, fallbackId?: string | null): Parsed {
  const out: Parsed = { extras: [] };
  const raw = (text || "").replace(/\r/g, "");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const setIf = (k: keyof Parsed, v: string) => {
    if (!v) return;
    if (!(out as any)[k]) (out as any)[k] = v.trim();
  };

  // 1) key: value lines
  for (const line of lines) {
    const m = line.match(/^([^:|=]{2,40})\s*[:=]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase().trim();
    const val = m[2].trim();
    if (/^(id|uid|user ?id|id ?do ?perfil|idperfil|c_user)$/.test(key)) setIf("id", val);
    else if (/(e-?mail).*(alt|recup|secund)/.test(key)) setIf("emailAlt", val);
    else if (/senha.*(e-?mail)|(e-?mail).*senha|pass.*mail/.test(key)) setIf("emailPassword", val);
    else if (/^(e-?mail|login|usuario|usuário|user)$/.test(key)) setIf("email", val);
    else if (/^(senha|password|pass|pwd|senha ?do ?facebook|senha ?fb)$/.test(key)) setIf("password", val);
    else if (/(2fa|two.?factor|autentic|token ?2fa|secret)/.test(key)) setIf("token2fa", val);
    else if (/(access ?token|token)/.test(key)) setIf("accessToken", val);
    else if (/cookie/.test(key)) setIf("cookies", val);
    else if (/(user ?agent|ua)$/.test(key)) setIf("userAgent", val);
    else if (/(nascimento|birth|data ?nasc)/.test(key)) setIf("birthday", val);
    else if (/(nome|name)/.test(key)) setIf("name", val);
    else if (val.length < 400) out.extras.push({ label: m[1].trim(), value: val });
  }

  // 2) pipe-separated format: id|email|senha|2fa|cookies|token
  const pipeLine = lines.find((l) => l.split("|").length >= 3 && !/^[a-z ]+:/i.test(l));
  if (pipeLine) {
    const parts = pipeLine.split("|").map((p) => p.trim());
    for (const p of parts) {
      if (!p) continue;
      if (/^\d{8,20}$/.test(p)) setIf("id", p);
      else if (EMAIL_RE.test(p)) { EMAIL_RE.lastIndex = 0; if (!out.email) out.email = p; else setIf("emailAlt", p); }
      else if (/c_user=/.test(p) || p.length > 120) setIf("cookies", p);
      else if (/^EAA[\w-]+/.test(p)) setIf("accessToken", p);
      else if (/^[A-Z2-7]{16,32}$/.test(p.replace(/\s/g, ""))) setIf("token2fa", p.replace(/\s/g, ""));
      else setIf("password", p);
    }
  }

  // 3) global fallbacks
  if (!out.cookies) {
    const m = raw.match(/[^\s|]*c_user=[^\s|]+/);
    if (m) out.cookies = m[0];
  }
  if (!out.accessToken) {
    const m = raw.match(/EAA[\w-]{20,}/);
    if (m) out.accessToken = m[0];
  }
  if (!out.id) {
    const m = raw.match(/c_user=(\d{6,20})/) || raw.match(/profile\.php\?id=(\d{6,20})/);
    if (m) out.id = m[1];
    else if (fallbackId) out.id = fallbackId;
  }
  const emails = Array.from(new Set(raw.match(EMAIL_RE) || []));
  if (!out.email && emails[0]) out.email = emails[0];
  if (!out.emailAlt && emails.length > 1) out.emailAlt = emails.find((e) => e !== out.email);

  return out;
}

function Field({
  label, value, secret, mono,
}: { label: string; value?: string; secret?: boolean; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(!secret);
  if (!value) return null;
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-start gap-1.5">
        <code
          className={`flex-1 min-w-0 px-2 py-1.5 rounded border border-border bg-muted/30 text-xs ${mono ? "font-mono" : ""} break-all max-h-24 overflow-y-auto`}
        >
          {show ? value : "••••••••••••"}
        </code>
        {secret && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShow((s) => !s)}>
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copy}>
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function BackupCredentialsModal({
  file, onClose,
}: { file: BackupCredFile | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!file) { setText(""); setParsed(null); setShowRaw(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 120);
        if (error || !data) throw new Error(error?.message || "Falha ao gerar link");
        const r = await fetch(data.signedUrl);
        const t = await r.text();
        if (cancelled) return;
        setText(t);
        setParsed(parseCredentials(t, file.fb_id ?? file.file_name.replace(/\.txt$/i, "")));
      } catch (e: any) {
        if (!cancelled) toast.error("Erro ao ler credenciais: " + (e?.message || ""));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  return (
    <Dialog open={!!file} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" /> Credenciais do perfil
          </DialogTitle>
          <DialogDescription className="text-xs break-all">{file?.file_name}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : parsed ? (
          <div className="space-y-3">
            <Field label="ID do perfil" value={parsed.id} mono />
            <Field label="Nome" value={parsed.name} />
            <Field label="E-mail" value={parsed.email} mono />
            <Field label="E-mail alternativo" value={parsed.emailAlt} mono />
            <Field label="Senha do Facebook" value={parsed.password} secret mono />
            <Field label="Senha do e-mail" value={parsed.emailPassword} secret mono />
            <Field label="Token 2FA" value={parsed.token2fa} secret mono />
            <Field label="Access Token" value={parsed.accessToken} secret mono />
            <Field label="Cookies" value={parsed.cookies} secret mono />
            <Field label="User Agent" value={parsed.userAgent} />
            <Field label="Data de nascimento" value={parsed.birthday} />

            {parsed.extras.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                {parsed.extras.slice(0, 12).