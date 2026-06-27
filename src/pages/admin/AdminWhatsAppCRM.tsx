import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Search, User, Loader2, RefreshCw, CheckCircle2, RotateCw, Zap, Plus, Trash2, UserCheck, Paperclip, Mic, Square, StickyNote, Tag as TagIcon, X, Volume2, VolumeX, Sparkles, Filter, Inbox, Clock, ArrowRightLeft } from "lucide-react";
import { PenLine } from "lucide-react";
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
  const [signature, setSignature] = useState<string>("");
  const [signatureDraft, setSignatureDraft] = useState<string>("");
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  
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
          .select("department_id, wa_signature")
          .eq("user_id", uid)
          .maybeSingle();
        setMyDeptId((prof as any)?.department_id ?? null);
        const sig = ((prof as any)?.wa_signature ?? "").toString();
        setSignature(sig);
        setSignatureDraft(sig);
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

  // Definitive avatar caching: rehost WhatsApp CDN photos (and fetch missing ones
  // via W-API) into Supabase Storage so they never expire / 403.
  const cachedAvatarsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!conversations.length) return;
    const needs = conversations
      .filter((c) => {
        if (cachedAvatarsRef.current.has(c.phone)) return false;
        const u = c.avatar_url || "";
        // Already cached in our storage? skip
        if (u.includes("/storage/v1/object/public/whatsapp-media/avatars/")) return false;
        return true; // either missing or pointing to expiring WA CDN
      })
      .slice(0, 40)
      .map((c) => c.phone);
    if (!needs.length) return;
    needs.forEach((p) => cachedAvatarsRef.current.add(p));
    supabase.functions
      .invoke("wa-avatar-cache", { body: { phones: needs } })
      .then(({ data }) => {
        if (data?.updated) qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      })
      .catch(() => {});
  }, [conversations, qc]);

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

  // Count how many outgoing messages the current attendant has already sent
  // in the selected conversation. The signature should only be prepended
  // to the first 2 messages of each attendant (so when a chat is
  // transferred, the new attendant also identifies themselves in their
  // first 2 replies).
  const myOutgoingCount = useMemo(() => {
    if (!me) return 0;
    return (messages || []).filter(
      (m) => m.direction === "out" && m.sender_user_id === me,
    ).length;
  }, [messages, me]);

  const appendSignature = (text: string): string => {
    const sig = (signature || "").trim();
    if (!sig) return text;
    // Only on the first 2 messages from this attendant in this convo
    if (myOutgoingCount >= 2) return text;
    const trimmedText = text.trimStart();
    // Avoid double-prepending if user kept it in the draft
    if (trimmedText.startsWith(sig)) return text;
    return `${sig}\n\n${trimmedText}`;
  };

  const saveSignature = async () => {
    if (!me) return;
    setSavingSignature(true);
    try {
      const value = signatureDraft.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ wa_signature: value || null })
        .eq("user_id", me);
      if (error) throw error;
      setSignature(value);
      toast.success("Assinatura salva!");
      setSignatureOpen(false);
    } catch (e: any) {
      toast.error("Erro ao salvar assinatura: " + (e.message || e));
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSend = async () => {
    if (!selectedPhone || !draft.trim() || sending) return;
    setSending(true);
    try {
      const message = appendSignature(draft.trim());
      const { data, error } = await supabase.functions.invoke("wapi-send", {
        body: {
          action: "send-text",
          phone: selectedPhone,
          message,
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
        const finalCaption = appendSignature(caption);
        if (finalCaption) payload.caption = finalCaption;
      } else if (isAudio) {
        payload.action = "send-audio";
        payload.audio_url = url;
      } else {
        // Documents: send as text with link (wapi-send sem ação de documento)
        payload.action = "send-text";
        payload.text = appendSignature((caption ? caption + "\n\n" : "") + `📎 ${fileName}\n${url}`);
      }
      const { data, error } = await supabase.functions.invoke("wapi-send", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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

  // Premium initials avatar — never generic
  const getInitials = (name: string | null | undefined, phone: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      const a = parts[0]?.[0] || "";
      const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
      return (a + b).toUpperCase().slice(0, 2);
    }
    const digits = phone.replace(/\D/g, "");
    return digits.slice(-2);
  };
  const avatarGradients = [
    "from-[#E5484D] to-[#8B1D21]",
    "from-[#4A4A52] to-[#23252B]",
    "from-[#6E56CF] to-[#352A6E]",
    "from-[#0AA866] to-[#054E2F]",
    "from-[#D97757] to-[#6E3C2C]",
    "from-[#2B7FFF] to-[#143F80]",
  ];
  const gradientFor = (key: string) => {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return avatarGradients[h % avatarGradients.length];
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-6 md:px-8 pt-2 pb-3 text-zinc-100 font-sans" style={{ background: "#0F1013" }}>
      <style>{`
        .crm-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .crm-scroll::-webkit-scrollbar-thumb { background: #2A2D33; border-radius: 999px; }
        .crm-scroll::-webkit-scrollbar-thumb:hover { background: #3A3D44; }
        .crm-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* Top bar */}
      <div className="flex flex-none items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl flex items-center justify-center shadow-[0_8px_24px_-12px_rgba(229,72,77,0.6)]"
               style={{ background: "linear-gradient(135deg,#E5484D 0%,#8B1D21 100%)" }}>
            <MessageCircle className="size-[18px] text-white" />
          </div>
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight leading-none">Inbox</h1>
            <p className="text-[12px] text-zinc-500 mt-1.5 leading-none">Central de atendimento WhatsApp · tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn(s => !s)}
            title={soundOn ? "Silenciar alertas" : "Ativar alertas"}
            className="size-9 rounded-[14px] bg-[#17191D] border border-white/[0.04] hover:border-white/[0.08] hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center justify-center text-zinc-400 hover:text-zinc-200"
          >
            {soundOn ? <Volume2 className="size-[15px]" /> : <VolumeX className="size-[15px]" />}
          </button>
          <button
            onClick={() => setQrModalOpen(true)}
            className="h-9 px-3.5 rounded-[14px] bg-[#17191D] border border-white/[0.04] hover:border-white/[0.08] hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center gap-1.5 text-[12.5px] text-zinc-300 hover:text-white"
          >
            <Zap className="size-[14px]" /> Respostas rápidas
          </button>
          <button
            onClick={() => { refetchConvos(); refetchMessages(); }}
            className="h-9 px-3.5 rounded-[14px] text-white hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center gap-1.5 text-[12.5px] shadow-[0_8px_20px_-10px_rgba(229,72,77,0.55)]"
            style={{ background: "linear-gradient(180deg,#E5484D 0%,#C42026 100%)" }}
          >
            <RefreshCw className="size-[14px]" /> Atualizar
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid flex-none grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {[
          { label: "Conversas abertas", value: metrics.open, icon: Inbox, accent: "#E5484D" },
          { label: "Mensagens não lidas", value: metrics.unread, icon: MessageCircle, accent: "#FFFFFF" },
          { label: "Atribuídas a mim", value: metrics.mineOpen, icon: UserCheck, accent: "#8FA0B4" },
          { label: "Resolvidas hoje", value: metrics.resolvedToday, icon: CheckCircle2, accent: "#6B7280" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-[18px] px-4 py-2.5 border border-white/[0.04] hover:border-white/[0.08] transition-colors duration-[180ms] shadow-[0_2px_24px_-12px_rgba(0,0,0,0.6)]"
            style={{ background: "#17191D" }}
          >
            <div className="flex items-start justify-between">
              <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                <m.icon className="size-[14px]" style={{ color: m.accent }} />
              </div>
              <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600 font-medium">Agora</span>
            </div>
            <div className="text-[24px] font-semibold tracking-tight mt-2 leading-none tabular-nums">{m.value}</div>
            <div className="text-[11.5px] text-zinc-500 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_1fr] gap-4">
        {/* Conversations sidebar */}
        <div className="rounded-[20px] flex flex-col overflow-hidden border border-white/[0.04] shadow-[0_2px_24px_-12px_rgba(0,0,0,0.6)]"
             style={{ background: "#131518" }}>
          <div className="p-4 space-y-3">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-[15px] text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar conversas..."
                className="pl-10 h-10 rounded-[14px] bg-[#0F1013] border-white/[0.04] focus-visible:border-white/[0.12] focus-visible:ring-0 text-[13px] placeholder:text-zinc-600 transition-all duration-[180ms]"
              />
            </div>
            <div className="flex gap-1.5">
              {(["open","resolved","all"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 text-[12px] font-medium py-2 rounded-[12px] transition-all duration-[180ms] active:scale-[0.98] ${
                    statusFilter === s
                      ? "bg-white text-[#0F1013] shadow-[0_4px_12px_-4px_rgba(255,255,255,0.2)]"
                      : "bg-transparent text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]"
                  }`}
                >
                  {s === "open" ? "Abertas" : s === "resolved" ? "Resolvidas" : "Todas"}
                  <span className={`ml-1.5 text-[10.5px] tabular-nums ${statusFilter === s ? "text-zinc-500" : "text-zinc-600"}`}>{counts[s]}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Select value={assignFilter} onValueChange={(v: any) => setAssignFilter(v)}>
                <SelectTrigger className="h-8 text-[11.5px] flex-1 rounded-[12px] bg-[#0F1013] border-white/[0.04] hover:border-white/[0.08] transition-colors">
                  <Filter className="size-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos atendentes</SelectItem>
                  <SelectItem value="mine">Atribuídas a mim</SelectItem>
                  <SelectItem value="unassigned">Sem atribuição</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tagFilter || "__all__"} onValueChange={(v) => setTagFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-[11.5px] flex-1 rounded-[12px] bg-[#0F1013] border-white/[0.04] hover:border-white/[0.08] transition-colors">
                  <TagIcon className="size-3 mr-1.5" />
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

          <div className="flex-1 overflow-y-auto crm-scroll px-2 pb-3">
            {loadingConvos ? (
              <div className="p-8 flex justify-center"><Loader2 className="animate-spin size-5 text-zinc-600" /></div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-10 text-center text-[12.5px] text-zinc-500">
                Nenhuma conversa ainda.<br />
                <span className="text-zinc-600">Mensagens recebidas aparecerão aqui.</span>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConvos.map(c => {
                  const unanswered = (c.unread_count || 0) > 0;
                  const selected = selectedPhone === c.phone;
                  const initials = getInitials(c.contact_name, c.phone);
                  return (
                  <button
                    key={c.phone}
                    onClick={() => setSelectedPhone(c.phone)}
                    className={`group relative w-full text-left p-3 rounded-[14px] transition-all duration-[180ms] flex gap-3 animate-fade-in ${
                      selected
                        ? "bg-[#1E2025] shadow-[0_6px_24px_-12px_rgba(0,0,0,0.7)]"
                        : "hover:bg-white/[0.025] hover:-translate-y-[1px]"
                    }`}
                  >
                    {selected && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full" style={{ background: "#E5484D" }} />
                    )}
                    <div className="relative shrink-0">
                      {c.avatar_url ? (
                        <Avatar className="size-10 ring-1 ring-white/[0.04]">
                          <AvatarImage src={c.avatar_url} alt={c.contact_name || c.phone} />
                          <AvatarFallback className={`bg-gradient-to-br ${gradientFor(c.phone)} text-white text-[12px] font-semibold`}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className={`size-10 rounded-full bg-gradient-to-br ${gradientFor(c.phone)} ring-1 ring-white/[0.06] flex items-center justify-center text-white text-[12px] font-semibold tracking-wide`}>
                          {initials}
                        </div>
                      )}
                      {unanswered && (
                        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-[#131518]" style={{ background: "#E5484D" }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[13px] truncate ${unanswered ? "font-semibold text-white" : "font-medium text-zinc-200"}`}>
                          {c.contact_name || formatPhone(c.phone)}
                        </span>
                        <span className={`text-[10.5px] shrink-0 tabular-nums ${unanswered ? "text-zinc-300" : "text-zinc-600"}`}>
                          {formatDistanceToNow(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className={`text-[12px] truncate ${unanswered ? "text-zinc-300" : "text-zinc-500"}`}>
                          {c.last_message_preview || "—"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.status === "resolved" && <CheckCircle2 className="size-3 text-zinc-600" />}
                          {c.unread_count > 0 && (
                            <span className="h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] font-semibold text-white flex items-center justify-center tabular-nums"
                                  style={{ background: "#E5484D" }}>
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                      {(c.tags && c.tags.length > 0) && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {c.tags.slice(0,3).map(tag => (
                            <span key={tag} className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Thread panel */}
        <div className="rounded-[20px] flex flex-col overflow-hidden border border-white/[0.04] shadow-[0_2px_24px_-12px_rgba(0,0,0,0.6)]"
             style={{ background: "#17191D" }}>
          {!selectedPhone ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="size-16 rounded-2xl flex items-center justify-center mb-5"
                   style={{ background: "linear-gradient(135deg,#1E2025 0%,#181A1F 100%)" }}>
                <MessageCircle className="size-7 text-zinc-600" />
              </div>
              <h3 className="text-[16px] font-semibold text-zinc-200 tracking-tight">Selecione uma conversa</h3>
              <p className="text-[12.5px] text-zinc-500 mt-1.5 max-w-sm">
                Escolha um atendimento à esquerda para começar a responder ou acompanhar o histórico em tempo real.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-8 w-full max-w-md">
                <div className="rounded-[16px] p-4 border border-white/[0.04]" style={{ background: "#181A1F" }}>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-600 font-medium">Abertas</div>
                  <div className="text-[22px] font-semibold tracking-tight mt-2 tabular-nums">{metrics.open}</div>
                </div>
                <div className="rounded-[16px] p-4 border border-white/[0.04]" style={{ background: "#181A1F" }}>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-600 font-medium">Não lidas</div>
                  <div className="text-[22px] font-semibold tracking-tight mt-2 tabular-nums" style={{ color: "#E5484D" }}>{metrics.unread}</div>
                </div>
                <div className="rounded-[16px] p-4 border border-white/[0.04]" style={{ background: "#181A1F" }}>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-600 font-medium">Suas</div>
                  <div className="text-[22px] font-semibold tracking-tight mt-2 tabular-nums">{metrics.mineOpen}</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.04] animate-fade-in">
                {selectedConvo?.avatar_url ? (
                  <Avatar className="size-10 ring-1 ring-white/[0.06]">
                    <AvatarImage src={selectedConvo.avatar_url} alt={selectedConvo?.contact_name || selectedPhone} />
                    <AvatarFallback className={`bg-gradient-to-br ${gradientFor(selectedPhone)} text-white text-[12px] font-semibold`}>
                      {getInitials(selectedConvo?.contact_name, selectedPhone)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className={`size-10 rounded-full bg-gradient-to-br ${gradientFor(selectedPhone)} ring-1 ring-white/[0.06] flex items-center justify-center text-white text-[12px] font-semibold tracking-wide`}>
                    {getInitials(selectedConvo?.contact_name, selectedPhone)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] text-white tracking-tight truncate">
                    {selectedConvo?.contact_name || formatPhone(selectedPhone)}
                  </div>
                  <div className="text-[11.5px] text-zinc-500 flex items-center gap-2 mt-0.5">
                    <span className="tabular-nums">{formatPhone(selectedPhone)}</span>
                    {selectedConvo?.client_user_id && (
                      <span className="inline-flex items-center gap-1 text-zinc-300">
                        <span className="size-1 rounded-full" style={{ background: "#0AA866" }} /> Cliente
                      </span>
                    )}
                    {assignedMember && (
                      <span className="inline-flex items-center gap-1 text-zinc-400">
                        <span className="size-1 rounded-full bg-zinc-500" /> {assignedMember.full_name || "—"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Select value={selectedConvo?.assigned_to || "unassigned"} onValueChange={(v) => handleAssign(v === "unassigned" ? null : v)}>
                    <SelectTrigger className="h-8 w-40 text-[11.5px] rounded-[12px] bg-[#0F1013] border-white/[0.04] hover:border-white/[0.08]">
                      <UserCheck className="size-3.5 mr-1.5" />
                      <SelectValue placeholder="Atribuir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sem atribuição</SelectItem>
                      {team.map(t => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.full_name || t.user_id.slice(0,8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={handleResolveToggle}
                    className={`h-8 px-3 rounded-[12px] text-[11.5px] font-medium flex items-center gap-1.5 transition-all duration-[180ms] active:scale-[0.98] hover:-translate-y-[1px] ${
                      selectedConvo?.status === "resolved"
                        ? "bg-[#0F1013] border border-white/[0.06] text-zinc-300 hover:text-white"
                         : "text-white shadow-[0_6px_16px_-8px_rgba(34,197,94,0.5)]"
                    }`}
                    style={selectedConvo?.status === "resolved" ? undefined : { background: "linear-gradient(180deg,#22C55E 0%,#15803D 100%)" }}
                  >
                    {selectedConvo?.status === "resolved"
                      ? <><RotateCw className="size-3.5" /> Reabrir</>
                      : <><CheckCircle2 className="size-3.5" /> Resolver</>}
                  </button>
                  <button
                    onClick={() => setTransferOpen(true)}
                    title="Transferir atendimento"
                    className="h-8 px-3 rounded-[12px] text-[11.5px] bg-[#0F1013] border border-white/[0.06] text-zinc-300 hover:text-white hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center gap-1.5"
                  >
                    <ArrowRightLeft className="size-3.5" /> Transferir
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        title="Notas internas"
                        className="size-8 rounded-[12px] bg-[#0F1013] border border-white/[0.06] text-zinc-400 hover:text-white hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center justify-center"
                      >
                        <StickyNote className="size-3.5" />
                      </button>
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
              <div className="px-5 py-2.5 flex items-center gap-1.5 flex-wrap border-b border-white/[0.04]" style={{ background: "#181A1F" }}>
                <TagIcon className="size-3 text-zinc-600" />
                {(selectedConvo?.tags || []).map(tag => (
                  <span key={tag} className="text-[10.5px] gap-1 pl-2 pr-1 py-0.5 rounded-full bg-white/[0.04] text-zinc-300 inline-flex items-center font-medium">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-zinc-500 hover:text-white transition-colors">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  placeholder="+ etiqueta"
                  className="h-6 w-28 text-[11px] px-2 rounded-full bg-[#0F1013] border-white/[0.04] focus-visible:ring-0 focus-visible:border-white/[0.12]"
                />
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto crm-scroll p-5 space-y-2.5" style={{ background: "#131518" }}>
                {messages.length === 0 ? (
                  <div className="text-center text-[12px] text-zinc-600 py-12">Sem mensagens nesta conversa.</div>
                ) : (
                  messages.map(m => (
                    <div key={m.id} className={`flex animate-fade-in ${m.from_me ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[72%] rounded-[16px] px-3.5 py-2 text-[13px] leading-relaxed shadow-[0_2px_10px_-6px_rgba(0,0,0,0.4)] ${
                        m.from_me
                          ? "text-white rounded-br-[6px]"
                          : "text-zinc-100 rounded-bl-[6px] border border-white/[0.04]"
                      }`}
                      style={m.from_me
                        ? { background: "linear-gradient(180deg,#2A2D33 0%,#1E2025 100%)" }
                        : { background: "#1E2025" }}>
                        {m.from_me && formatSender(m.sender_user_id, m.sender_department_id) && (
                          <div className="text-[10px] font-semibold text-white/75 mb-1 leading-tight tracking-wide uppercase">
                            {formatSender(m.sender_user_id, m.sender_department_id)}
                          </div>
                        )}
                        {m.media_url && m.message_type === "image" && (
                          <button
                            type="button"
                            onClick={() => { setLightboxUrl(m.media_url!); setLightboxZoom(1); }}
                            className="block mb-1 group"
                            title="Clique para ampliar"
                          >
                            <img
                              src={m.media_url}
                              alt=""
                              className="rounded-[12px] max-w-full max-h-[420px] w-auto h-auto object-contain cursor-zoom-in group-hover:opacity-95 transition-opacity"
                            />
                          </button>
                        )}
                        {m.media_url && m.message_type === "audio" && (
                          <AudioMessagePlayer src={m.media_url} className="mb-1" variant={m.from_me ? "sent" : "received"} />
                        )}
                        {m.media_url && !["image","audio"].includes(m.message_type) && (
                          <a href={m.media_url} target="_blank" rel="noreferrer" className="text-[11.5px] underline underline-offset-2 opacity-90">
                            Abrir mídia ({m.message_type})
                          </a>
                        )}
                        {(m.body || (!m.media_url)) && (
                          <div className="whitespace-pre-wrap break-words">{m.body || "(vazio)"}</div>
                        )}
                        <div className={`flex items-center justify-end gap-1 mt-1 ${m.from_me ? "text-white/75" : "text-zinc-500"}`}>
                          <span className="text-[9.5px] tabular-nums">
                            {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {m.from_me && (() => {
                            const s = (m as any).status as string | undefined;
                            if (s === "read") return <CheckCheck className="size-3 text-white" aria-label="Lida" />;
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

              <div className="px-5 py-4 space-y-3 border-t border-white/[0.04]" style={{ background: "#17191D" }}>
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-zinc-500">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PenLine className="size-3 shrink-0" />
                    <span className="shrink-0">Assinatura:</span>
                    {signature ? (
                      <span className="truncate text-zinc-300 font-medium">{signature}</span>
                    ) : (
                      <span className="italic">não configurada</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="h-6 px-2 text-[11px] rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                    onClick={() => { setSignatureDraft(signature); setSignatureOpen(true); }}
                  >
                    {signature ? "Editar" : "Definir"}
                  </button>
                </div>
                {quickReplies.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="h-7 px-2.5 text-[11.5px] rounded-[10px] bg-[#0F1013] border border-white/[0.04] text-zinc-300 hover:text-white hover:border-white/[0.08] transition-all duration-[180ms] flex items-center gap-1.5">
                          <Zap className="size-3" /> Respostas rápidas
                        </button>
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || recording}
                  title="Anexar imagem, áudio ou documento"
                  className="shrink-0 size-11 rounded-[14px] bg-[#0F1013] border border-white/[0.04] hover:border-white/[0.08] text-zinc-400 hover:text-white disabled:opacity-40 hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center justify-center"
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={uploading}
                  title={recording ? "Parar gravação" : "Gravar áudio"}
                  className={`shrink-0 size-11 rounded-[14px] border hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center justify-center ${
                    recording
                      ? "text-white border-transparent"
                      : "bg-[#0F1013] border-white/[0.04] hover:border-white/[0.08] text-zinc-400 hover:text-white disabled:opacity-40"
                  }`}
                  style={recording ? { background: "linear-gradient(180deg,#E5484D 0%,#C42026 100%)" } : undefined}
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={aiLoading || uploading || recording}
                  title="Sugestão de resposta com IA"
                  className="shrink-0 size-11 rounded-[14px] bg-[#0F1013] border border-white/[0.04] hover:border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-40 hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] flex items-center justify-center"
                >
                  {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                </button>
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
                  placeholder="Escreva uma mensagem..."
                  className="min-h-[44px] max-h-32 resize-none rounded-[14px] bg-[#0F1013] border-white/[0.04] focus-visible:border-white/[0.12] focus-visible:ring-0 text-[13px] placeholder:text-zinc-600 px-3.5 py-3"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="shrink-0 h-11 px-5 rounded-[14px] text-white text-[13px] font-medium flex items-center gap-2 disabled:opacity-40 hover:-translate-y-[1px] active:scale-[0.98] transition-all duration-[180ms] shadow-[0_8px_20px_-10px_rgba(34,197,94,0.6)]"
                  style={{ background: "linear-gradient(180deg,#22C55E 0%,#15803D 100%)" }}
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <><Send className="size-4" /> Enviar</>}
                </button>
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

      {/* Image lightbox — view at real/zoomable size */}
      <Dialog open={!!lightboxUrl} onOpenChange={(o) => { if (!o) { setLightboxUrl(null); setLightboxZoom(1); } }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 bg-black/95 border-none overflow-hidden flex flex-col">
          <div className="flex items-center justify-end gap-2 px-3 py-2 bg-black/70 text-white text-xs shrink-0">
            <button
              onClick={() => setLightboxZoom(z => Math.max(0.25, z - 0.25))}
              className="px-2 py-1 rounded hover:bg-white/10"
              title="Diminuir zoom"
            >−</button>
            <span className="tabular-nums w-12 text-center">{Math.round(lightboxZoom * 100)}%</span>
            <button
              onClick={() => setLightboxZoom(z => Math.min(8, z + 0.25))}
              className="px-2 py-1 rounded hover:bg-white/10"
              title="Aumentar zoom"
            >+</button>
            <button
              onClick={() => setLightboxZoom(1)}
              className="px-2 py-1 rounded hover:bg-white/10"
              title="Tamanho real (100%)"
            >1:1</button>
            {lightboxUrl && (
              <a
                href={lightboxUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-1 rounded hover:bg-white/10"
                title="Abrir original em nova aba"
              >Abrir original</a>
            )}
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center">
            {lightboxUrl && (
              <img
                src={lightboxUrl}
                alt=""
                style={{ transform: `scale(${lightboxZoom})`, transformOrigin: "center center" }}
                className="max-w-none transition-transform duration-100 select-none"
                draggable={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assinatura no WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta assinatura será anexada automaticamente ao final de cada mensagem que você enviar pelo CRM.
            </p>
            <Textarea
              value={signatureDraft}
              onChange={(e) => setSignatureDraft(e.target.value)}
              placeholder="Ex: Fabricio | Comercial"
              className="min-h-[100px] resize-none"
              maxLength={200}
            />
            <div className="text-xs text-muted-foreground">
              Pré-visualização:
              <div className="mt-1 p-2 rounded bg-muted/50 whitespace-pre-wrap font-mono text-xs">
                Sua mensagem aqui...{signatureDraft.trim() ? `\n\n${signatureDraft.trim()}` : ""}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureOpen(false)}>Cancelar</Button>
            <Button onClick={saveSignature} disabled={savingSignature}>
              {savingSignature ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Salvar assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}