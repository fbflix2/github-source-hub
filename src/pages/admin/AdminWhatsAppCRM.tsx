import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Search, User, Loader2, RefreshCw, CheckCircle2, RotateCw, Zap, Plus, Trash2, UserCheck, Paperclip, Mic, Square, StickyNote, Tag as TagIcon, X, Volume2, VolumeX, Sparkles, Filter, Inbox, Clock, ArrowRightLeft } from "lucide-react";
import { Check, CheckCheck } from "lucide-react";
import { ConversationTransferModal } from "@/components/admin/ConversationTransferModal";
import { AudioMessagePlayer } from "@/components/admin/AudioMessagePlayer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conversation = {
  phone: string;
  contact_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  assigned_to: string | null;
  client_user_id: string | null;
  tags: string[] | null;
  internal_notes: string | null;
  avatar_url: string | null;
};

type Message = {
  id: string;
  phone: string;
  direction: "in" | "out";
  from_me: boolean;
  body: string | null;
  message_type: string;
  media_url: string | null;
  created_at: string;
  sender_user_id?: string | null;
  sender_department_id?: string | null;
};

type TeamMember = { user_id: string; full_name: string | null };
type TeamMemberFull = TeamMember & { department_id: string | null };
type Department = { id: string; name: string; color: string | null };
type QuickReply = { id: string; shortcut: string; body: string };

export default function AdminWhatsAppCRM() {
  const qc = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [newQrShortcut, setNewQrShortcut] = useState("");
  const [newQrBody, setNewQrBody] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [newTag, setNewTag] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [assignFilter, setAssignFilter] = useState<"all" | "mine" | "unassigned">("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [me, setMe] = useState<string | null>(null);
  const [myDeptId, setMyDeptId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIncomingTsRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || null;
      setMe(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("department_id")
          .eq("user_id", uid)
          .maybeSingle();
        setMyDeptId((prof as any)?.department_id ?? null);
      }
    });
  }, []);

  const { data: conversations = [], isLoading: loadingConvos, refetch: refetchConvos } = useQuery({
    queryKey: ["wa-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Conversation[];
    },
    refetchInterval: 15000,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["wa-messages", selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, phone, direction, from_me, body, message_type, media_url, created_at, sender_user_id, sender_department_id")
        .eq("phone", selectedPhone)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedPhone,
    refetchInterval: 5000,
  });

  // Team members (admins + moderators) for assignment
  const { data: team = [] } = useQuery({
    queryKey: ["wa-team"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "moderator"]);
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [] as TeamMember[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, department_id")
        .in("user_id", ids);
      return (profs || []) as TeamMemberFull[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["wa-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments" as any).select("id, name, color");
      return ((data as any) ?? []) as Department[];
    },
  });
  const deptMap = useMemo(() => {
    const m = new Map<string, Department>();
    departments.forEach(d => m.set(d.id, d));
    return m;
  }, [departments]);
  const memberMap = useMemo(() => {
    const m = new Map<string, TeamMemberFull>();
    (team as TeamMemberFull[]).forEach(t => m.set(t.user_id, t));
    return m;
  }, [team]);

  const formatSender = (uid?: string | null, did?: string | null): string | null => {
    if (!uid && !did) return null;
    const member = uid ? memberMap.get(uid) : undefined;
    const dept = did ? deptMap.get(did) : (member?.department_id ? deptMap.get(member.department_id) : undefined);
    const name = member?.full_name?.trim();
    if (name && dept?.name) return `${name} | ${dept.name}`;
    if (name) return name;
    if (dept?.name) return dept.name;
    return null;
  };

  // Quick replies
  const { data: quickReplies = [], refetch: refetchQr } = useQuery({
    queryKey: ["wa-quick-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_quick_replies")
        .select("id, shortcut, body")
        .order("shortcut", { ascending: true });
      if (error) throw error;
      return data as QuickReply[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("wa-crm")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["wa-messages"] });
        qc.invalidateQueries({ queryKey: ["wa-conversations"] });
        const row = payload?.new;
        if (row?.direction === "in" && soundOn) playPing();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, soundOn]);

  // Sync notes draft when switching conversations
  useEffect(() => {
    const c = conversations.find(x => x.phone === selectedPhone);
    setNotesDraft(c?.internal_notes || "");
  }, [selectedPhone, conversations]);

  // Debounced auto-save for notes
  useEffect(() => {
    if (!selectedPhone) return;
    const current = conversations.find(c => c.phone === selectedPhone);
    if ((current?.internal_notes || "") === notesDraft) return;
    const t = setTimeout(() => {
      updateConvo({ internal_notes: notesDraft });
    }, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, selectedPhone]);

  // Mark as read when opening
  useEffect(() => {
    if (!selectedPhone) return;
    supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("phone", selectedPhone)
      .then(() => qc.invalidateQueries({ queryKey: ["wa-conversations"] }));
  }, [selectedPhone, qc]);

  const filteredConvos = useMemo(() => {
    let list = conversations;
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter);
    if (assignFilter === "mine" && me) list = list.filter(c => c.assigned_to === me);
    if (assignFilter === "unassigned") list = list.filter(c => !c.assigned_to);
    if (tagFilter) list = list.filter(c => (c.tags || []).includes(tagFilter));
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.phone.includes(q) ||
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.last_message_preview || "").toLowerCase().includes(q)
    );
  }, [conversations, search, statusFilter, assignFilter, tagFilter, me]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    conversations.forEach(c => (c.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [conversations]);

  const metrics = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const unread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const open = conversations.filter(c => c.status === "open").length;
    const resolvedToday = conversations.filter(c => c.status === "resolved" && new Date(c.last_message_at) >= todayStart).length;
    const mineOpen = me ? conversations.filter(c => c.assigned_to === me && c.status === "open").length : 0;
    return { unread, open, resolvedToday, mineOpen };
  }, [conversations, me]);

  const selectedConvo = conversations.find(c => c.phone === selectedPhone);
  const assignedMember = team.find(t => t.user_id === selectedConvo?.assigned_to);

  const updateConvo = async (patch: Partial<Conversation>) => {
    if (!selectedPhone) return;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("phone", selectedPhone);
    if (error) { toast.error(error.message); return; }
    refetchConvos();
  };

  const handleResolveToggle = async () => {
    if (!selectedConvo) return;
    const next = selectedConvo.status === "resolved" ? "open" : "resolved";
    await updateConvo({ status: next });
    toast.success(next === "resolved" ? "Conversa marcada como resolvida" : "Conversa reaberta");
  };

  const handleAssign = async (userId: string | null) => {
    await updateConvo({ assigned_to: userId });
    toast.success(userId ? "Conversa atribuída" : "Atribuição removida");
  };

  const handleCreateQr = async () => {
    if (!newQrShortcut.trim() || !newQrBody.trim()) return;
    const { error } = await supabase.from("whatsapp_quick_replies").insert({
      shortcut: newQrShortcut.trim(),
      body: newQrBody.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewQrShortcut(""); setNewQrBody("");
    refetchQr();
    toast.success("Resposta rápida criada");
  };

  const handleDeleteQr = async (id: string) => {
    const { error } = await supabase.from("whatsapp_quick_replies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetchQr();
  };

  const handleSend = async () => {
    if (!selectedPhone || !draft.trim() || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("wapi-send", {
        body: {
          action: "send-text",
          phone: selectedPhone,
          message: draft.trim(),
          event_key: "crm_manual",
          user_id: selectedConvo?.client_user_id || null,
          sender_user_id: me,
          sender_department_id: myDeptId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft("");
      // Auto-mark as open when staff replies
      if (selectedConvo?.status === "resolved") {
        await updateConvo({ status: "open" });
      }
      refetchMessages();
      refetchConvos();
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e.message || e));
    } finally {
      setSending(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!selectedPhone || aiLoading) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-suggest-reply", {
        body: { phone: selectedPhone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.suggestion) setDraft(d => d ? d + "\n" + data.suggestion : data.suggestion);
    } catch (e: any) {
      toast.error("IA: " + (e.message || e));
    } finally {
      setAiLoading(false);
    }
  };

  const playPing = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {}
  };

  const uploadToBucket = async (file: Blob, ext: string): Promise<string | null> => {
    if (!selectedPhone) return null;
    const path = `crm/${selectedPhone}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error } = await supabase.storage.from("support-attachments").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) { toast.error("Upload falhou: " + error.message); return null; }
    const { data } = supabase.storage.from("support-attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedPhone) return;
    await sendAttachment(file);
  };

  const sendAttachment = async (file: File | Blob, suggestedName?: string) => {
    if (!selectedPhone) return;
    const fileName = (file as File).name || suggestedName || `arquivo-${Date.now()}`;
    const fileType = file.type || "application/octet-stream";
    const isImage = fileType.startsWith("image/");
    const isAudio = fileType.startsWith("audio/");
    if (file.size > 16 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 16MB)."); return; }
    setUploading(true);
    try {
      const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : (isImage ? "jpg" : isAudio ? "ogg" : "bin");
      const url = await uploadToBucket(file, ext);
      if (!url) return;
      const caption = draft.trim();
      let payload: any = {
        phone: selectedPhone,
        event_key: "crm_manual",
        user_id: selectedConvo?.client_user_id || null,
        sender_user_id: me,
        sender_department_id: myDeptId,
      };
      if (isImage) {
        payload.action = "send-image";
        payload.image_url = url;
        if (caption) payload.caption = caption;
      } else if (isAudio) {
        payload.action = "send-audio";
        payload.audio_url = url;
      } else {
        // Documents: send as text with link (wapi-send sem ação de documento)
        payload.action = "send-text";
        payload.text = (caption ? caption + "\n\n" : "") + `📎 ${fileName}\n${url}`;
      }
      const { data, error } = await supabase.functions.invoke("wapi-send", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await supabase.from("whatsapp_messages").insert({
        phone: selectedPhone,
        direction: "out",
        from_me: true,
        body: isImage ? (caption || null) : (isAudio ? null : `📎 ${fileName}`),
        message_type: isImage ? "image" : isAudio ? "audio" : "document",
        media_url: url,
        status: "sent",
        sender_user_id: me,
        sender_department_id: myDeptId,
      });
      setDraft("");
      if (selectedConvo?.status === "resolved") await updateConvo({ status: "open" });
      refetchMessages();
    } catch (err: any) {
      toast.error("Falha ao enviar arquivo. " + (err.message || "Tente novamente."));
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          await sendAttachment(file, `colado-${Date.now()}.${(file.type.split("/")[1] || "png")}`);
          return;
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        if (blob.size < 800) { toast.error("Áudio muito curto"); return; }
        setUploading(true);
        try {
          const url = await uploadToBucket(blob, "webm");
          if (!url || !selectedPhone) return;
          const { data, error } = await supabase.functions.invoke("wapi-send", {
            body: { action: "send-audio", phone: selectedPhone, audio_url: url, event_key: "crm_manual", user_id: selectedConvo?.client_user_id || null, sender_user_id: me, sender_department_id: myDeptId },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          await supabase.from("whatsapp_messages").insert({
            phone: selectedPhone, direction: "out", from_me: true,
            body: null, message_type: "audio", media_url: url, status: "sent",
            sender_user_id: me, sender_department_id: myDeptId,
          });
          if (selectedConvo?.status === "resolved") await updateConvo({ status: "open" });
          refetchMessages();
        } catch (err: any) {
          toast.error("Erro ao enviar áudio: " + (err.message || err));
        } finally {
          setUploading(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e: any) {
      toast.error("Microfone indisponível: " + (e.message || e));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const handleAddTag = async () => {
    const t = newTag.trim().toLowerCase();
    if (!t || !selectedConvo) return;
    const next = Array.from(new Set([...(selectedConvo.tags || []), t]));
    await updateConvo({ tags: next });
    setNewTag("");
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedConvo) return;
    const next = (selectedConvo.tags || []).filter(x => x !== tag);
    await updateConvo({ tags: next });
  };

  const formatPhone = (p: string) => {
    if (p.length === 13 && p.startsWith("55")) {
      return `+55 (${p.slice(2,4)}) ${p.slice(4,9)}-${p.slice(9)}`;
    }
    return "+" + p;
  };

  const counts = useMemo(() => ({
    open: conversations.filter(c => c.status === "open").length,
    resolved: conversations.filter(c => c.status === "resolved").length,
    all: conversations.length,
  }), [conversations]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
            <MessageCircle className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CRM WhatsApp</h1>
            <p className="text-xs text-muted-foreground">Painel de atendimento — conversas em tempo real</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSoundOn(s => !s)} title={soundOn ? "Silenciar alertas" : "Ativar alertas"}>
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrModalOpen(true)}>
            <Zap className="size-4 mr-1.5" /> Respostas rápidas
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetchConvos(); refetchMessages(); }}>
            <RefreshCw className="size-4 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Abertas", value: metrics.open, icon: Inbox, color: "text-emerald-500" },
          { label: "Não lidas", value: metrics.unread, icon: MessageCircle, color: "text-green-500" },
          { label: "Minhas abertas", value: metrics.mineOpen, icon: UserCheck, color: "text-blue-400" },
          { label: "Resolvidas hoje", value: metrics.resolvedToday, icon: CheckCircle2, color: "text-emerald-400" },
        ].map((m) => (
          <div key={m.label} className="bg-card/60 border border-border/40 rounded-xl p-3 flex items-center gap-3">
            <div className={`size-9 rounded-lg bg-muted/40 flex items-center justify-center ${m.color}`}>
              <m.icon className="size-4" />
            </div>
            <div>
              <div className="text-xl font-bold leading-none">{m.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-280px)]">
        {/* Conversations list */}
        <div className="bg-card/60 border border-border/40 rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa..."
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {(["open","resolved","all"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 text-xs py-1.5 rounded-md transition ${statusFilter === s ? "bg-green-600 text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                >
                  {s === "open" ? "Abertas" : s === "resolved" ? "Resolvidas" : "Todas"} ({counts[s]})
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <Select value={assignFilter} onValueChange={(v: any) => setAssignFilter(v)}>
                <SelectTrigger className="h-7 text-[11px] flex-1">
                  <Filter className="size-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos atendentes</SelectItem>
                  <SelectItem value="mine">Atribuídas a mim</SelectItem>
                  <SelectItem value="unassigned">Sem atribuição</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tagFilter || "__all__"} onValueChange={(v) => setTagFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-7 text-[11px] flex-1">
                  <TagIcon className="size-3 mr-1" />
                  <SelectValue placeholder="Etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas etiquetas</SelectItem>
                  {allTags.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingConvos ? (
              <div className="p-8 flex justify-center"><Loader2 className="animate-spin size-5 text-muted-foreground" /></div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma conversa ainda.<br />
                Mensagens recebidas via WhatsApp aparecerão aqui.
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredConvos.map(c => {
                  const unanswered = (c.unread_count || 0) > 0;
                  return (
                  <button
                    key={c.phone}
                    onClick={() => setSelectedPhone(c.phone)}
                    className={`w-full text-left p-3 hover:bg-white/5 transition-colors flex gap-3 border-l-2 ${
                      selectedPhone === c.phone
                        ? "bg-white/10 border-l-green-500"
                        : unanswered
                          ? "bg-green-500/[0.04] border-l-green-500/70"
                          : "border-l-transparent"
                    }`}
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage src={c.avatar_url || undefined} alt={c.contact_name || c.phone} />
                      <AvatarFallback className="bg-muted">
                        <User className="size-5 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${unanswered ? "font-bold text-foreground" : "font-medium"}`}>
                          {c.contact_name || formatPhone(c.phone)}
                        </span>
                        <span className={`text-[10px] shrink-0 ${unanswered ? "text-green-500 font-semibold" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`text-xs truncate ${unanswered ? "text-foreground/90" : "text-muted-foreground"}`}>
                          {c.last_message_preview || "—"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.status === "resolved" && <CheckCircle2 className="size-3 text-emerald-500" />}
                          {c.unread_count > 0 && (
                            <Badge className="bg-green-500 text-white h-5 min-w-5 px-1.5 text-[10px]">
                              {c.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {unanswered && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-green-500">
                          <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                          Aguardando resposta
                        </div>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Thread */}
        <div className="bg-card/60 border border-border/40 rounded-xl flex flex-col overflow-hidden">
          {!selectedPhone ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border/40 flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={selectedConvo?.avatar_url || undefined} alt={selectedConvo?.contact_name || selectedPhone} />
                  <AvatarFallback className="bg-muted">
                    <User className="size-4 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {selectedConvo?.contact_name || formatPhone(selectedPhone)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatPhone(selectedPhone)}
                    {selectedConvo?.client_user_id && <span className="ml-2 text-green-500">• Cliente</span>}
                    {assignedMember && <span className="ml-2 text-blue-400">• Atendente: {assignedMember.full_name || "—"}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Select value={selectedConvo?.assigned_to || "unassigned"} onValueChange={(v) => handleAssign(v === "unassigned" ? null : v)}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <UserCheck className="size-3.5 mr-1" />
                      <SelectValue placeholder="Atribuir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sem atribuição</SelectItem>
                      {team.map(t => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.full_name || t.user_id.slice(0,8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant={selectedConvo?.status === "resolved" ? "outline" : "default"}
                    onClick={handleResolveToggle}
                    className={selectedConvo?.status === "resolved" ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                  >
                    {selectedConvo?.status === "resolved"
                      ? <><RotateCw className="size-3.5 mr-1" /> Reabrir</>
                      : <><CheckCircle2 className="size-3.5 mr-1" /> Resolver</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)} title="Transferir atendimento">
                    <ArrowRightLeft className="size-3.5 mr-1" /> Transferir
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8" title="Notas internas">
                        <StickyNote className="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-2">
                        <div className="text-xs font-medium flex items-center gap-1.5"><StickyNote className="size-3.5" /> Notas internas</div>
                        <Textarea
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Anotações visíveis apenas para a equipe..."
                          rows={6}
                          className="text-xs"
                        />
                        <div className="text-[10px] text-muted-foreground">Salvamento automático</div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Tags row */}
              <div className="px-3 py-2 border-b border-border/30 flex items-center gap-1.5 flex-wrap bg-card/40">
                <TagIcon className="size-3 text-muted-foreground" />
                {(selectedConvo?.tags || []).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[10px] gap-1 pr-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  placeholder="+ etiqueta"
                  className="h-6 w-28 text-[11px] px-2"
                />
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/30">
                {messages.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8">Sem mensagens</div>
                ) : (
                  messages.map(m => (
                    <div key={m.id} className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        m.from_me
                          ? "bg-green-600 text-white rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        {m.from_me && formatSender(m.sender_user_id, m.sender_department_id) && (
                          <div className="text-[10px] font-semibold text-white/80 mb-1 leading-tight">
                            {formatSender(m.sender_user_id, m.sender_department_id)}
                          </div>
                        )}
                        {m.media_url && m.message_type === "image" && (
                          <a href={m.media_url} target="_blank" rel="noreferrer">
                            <img src={m.media_url} alt="" className="rounded-lg max-w-full max-h-64 mb-1" />
                          </a>
                        )}
                        {m.media_url && m.message_type === "audio" && (
                          <AudioMessagePlayer src={m.media_url} className="mb-1" variant={m.from_me ? "sent" : "received"} />
                        )}
                        {m.media_url && !["image","audio"].includes(m.message_type) && (
                          <a href={m.media_url} target="_blank" rel="noreferrer" className="text-[11px] underline opacity-90">
                            Abrir mídia ({m.message_type})
                          </a>
                        )}
                        {(m.body || (!m.media_url)) && (
                          <div className="whitespace-pre-wrap break-words">{m.body || "(vazio)"}</div>
                        )}
                        <div className={`flex items-center justify-end gap-1 mt-1 ${m.from_me ? "text-white/80" : "text-muted-foreground"}`}>
                          <span className="text-[9px]">
                            {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {m.from_me && (() => {
                            const s = (m as any).status as string | undefined;
                            if (s === "read") return <CheckCheck className="size-3 text-sky-300" aria-label="Lida" />;
                            if (s === "delivered") return <CheckCheck className="size-3" aria-label="Entregue" />;
                            if (s === "sent") return <Check className="size-3" aria-label="Enviada" />;
                            if (s === "failed") return <X className="size-3 text-red-300" aria-label="Falhou" />;
                            return <Clock className="size-3 opacity-70" aria-label="Pendente" />;
                          })()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-border/40 space-y-2">
                {quickReplies.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <Zap className="size-3 mr-1" /> Respostas rápidas
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-2" align="start">
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {quickReplies.map(qr => (
                            <button
                              key={qr.id}
                              onClick={() => setDraft(d => d ? d + "\n" + qr.body : qr.body)}
                              className="w-full text-left p-2 rounded hover:bg-muted/50"
                            >
                              <div className="text-xs font-medium text-primary">/{qr.shortcut}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">{qr.body}</div>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                <input ref={fileInputRef} type="file" accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" hidden onChange={handleFilePick} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-11 w-11"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || recording}
                  title="Anexar imagem ou áudio"
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                </Button>
                <Button
                  type="button"
                  variant={recording ? "destructive" : "outline"}
                  size="icon"
                  className="shrink-0 h-11 w-11"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={uploading}
                  title={recording ? "Parar gravação" : "Gravar áudio"}
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-11 w-11"
                  onClick={handleAiSuggest}
                  disabled={aiLoading || uploading || recording}
                  title="Sugestão de resposta com IA"
                >
                  {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-violet-400" />}
                </Button>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
                  className="min-h-[44px] max-h-32 resize-none"
                />
                <Button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick replies management modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="size-5 text-primary" /> Respostas rápidas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {quickReplies.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">Nenhuma resposta rápida cadastrada</div>
              ) : quickReplies.map(qr => (
                <div key={qr.id} className="flex gap-2 p-2 rounded border border-border/30">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-primary">/{qr.shortcut}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{qr.body}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteQr(qr.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t border-border/30 pt-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Criar nova</div>
              <Input
                placeholder="Atalho (ex: saudacao)"
                value={newQrShortcut}
                onChange={(e) => setNewQrShortcut(e.target.value)}
              />
              <Textarea
                placeholder="Mensagem completa..."
                value={newQrBody}
                onChange={(e) => setNewQrBody(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrModalOpen(false)}>Fechar</Button>
            <Button onClick={handleCreateQr} className="bg-primary text-white">
              <Plus className="size-4 mr-1" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {transferOpen && selectedPhone && (
        <ConversationTransferModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          kind="whatsapp"
          conversationPhone={selectedPhone}
          currentAssignee={selectedConvo?.assigned_to ?? null}
          currentDepartmentId={(selectedConvo as any)?.department_id ?? null}
          onTransferred={() => { refetchConvos(); }}
        />
      )}
    </div>
  );
}