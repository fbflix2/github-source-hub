import { useEffect, useState } from "react";
import { X, Download, Copy, ThumbsUp, ThumbsDown, Send, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface AttachmentItem { label: string; url: string; }
export interface CopyItem { label: string; value: string; }

export interface TutorialForModal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  video_url: string | null;
  attachments?: AttachmentItem[] | null;
  copy_items?: CopyItem[] | null;
}

function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1` : null;
}

function getVimeoEmbed(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:manage\/videos\/|video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}?autoplay=1` : null;
}

export function getTutorialEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  return getYouTubeEmbed(url) || getVimeoEmbed(url);
}

interface FeedbackRow {
  id: string;
  user_id: string;
  helpful: boolean | null;
  comment: string | null;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  tutorial: TutorialForModal;
  onClose: () => void;
}

export function TutorialPlayerModal({ tutorial, onClose }: Props) {
  const embedUrl = getTutorialEmbedUrl(tutorial.video_url);
  const [userId, setUserId] = useState<string | null>(null);
  const [myFeedback, setMyFeedback] = useState<FeedbackRow | null>(null);
  const [comments, setComments] = useState<FeedbackRow[]>([]);
  const [helpfulCount, setHelpfulCount] = useState(0);
  const [notHelpfulCount, setNotHelpfulCount] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const loadFeedback = async () => {
    const { data: rows } = await supabase
      .from("tutorial_feedback")
      .select("id, user_id, helpful, comment, created_at")
      .eq("tutorial_id", tutorial.id)
      .order("created_at", { ascending: false });
    const list = rows || [];

    // Hydrate profiles
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      for (const p of profs || []) {
        profilesMap.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url });
      }
    }
    const enriched: FeedbackRow[] = list.map((r) => ({ ...r, profile: profilesMap.get(r.user_id) ?? null }));

    setComments(enriched.filter((r) => r.comment && r.comment.trim().length > 0));
    setHelpfulCount(enriched.filter((r) => r.helpful === true).length);
    setNotHelpfulCount(enriched.filter((r) => r.helpful === false).length);
    if (userId) {
      setMyFeedback(enriched.find((r) => r.user_id === userId) || null);
    }
  };

  useEffect(() => {
    loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial.id, userId]);

  const upsertFeedback = async (patch: { helpful?: boolean | null; comment?: string | null }) => {
    if (!userId) {
      toast.error("Faça login para avaliar");
      return;
    }
    const payload = {
      tutorial_id: tutorial.id,
      user_id: userId,
      helpful: patch.helpful !== undefined ? patch.helpful : myFeedback?.helpful ?? null,
      comment: patch.comment !== undefined ? patch.comment : myFeedback?.comment ?? null,
    };
    const { error } = await supabase
      .from("tutorial_feedback")
      .upsert(payload, { onConflict: "tutorial_id,user_id" });
    if (error) {
      toast.error("Erro ao salvar avaliação");
    } else {
      await loadFeedback();
    }
  };

  const handleHelpful = (val: boolean) => {
    const newVal = myFeedback?.helpful === val ? null : val;
    upsertFeedback({ helpful: newVal });
  };

  const handleSendComment = async () => {
    if (!commentDraft.trim()) return;
    await upsertFeedback({ comment: commentDraft.trim() });
    setCommentDraft("");
    toast.success("Comentário enviado");
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const attachments = (tutorial.attachments || []).filter((a) => a?.url);
  const copyItems = (tutorial.copy_items || []).filter((c) => c?.value);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-start md:items-center justify-center p-2 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          {/* Player */}
          <div className="lg:col-span-3 bg-black">
            <div className="aspect-video w-full">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={tutorial.title}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
                  Vídeo indisponível
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 p-5 md:p-6 max-h-[70vh] lg:max-h-[80vh] overflow-y-auto space-y-6">
            <div>
              {tutorial.category && (
                <span className="inline-block text-[10px] uppercase tracking-wider text-primary font-bold mb-2">
                  {tutorial.category}
                </span>
              )}
              <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">
                {tutorial.title}
              </h2>
              {tutorial.description && (
                <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap leading-relaxed">
                  {tutorial.description}
                </p>
              )}
            </div>

            {/* Copy items */}
            {copyItems.length > 0 && (
              <div>
                <h3 className="text-xs uppercase font-semibold text-gray-400 mb-2 tracking-wider">
                  Links e dados
                </h3>
                <div className="space-y-2">
                  {copyItems.map((item, idx) => {
                    const k = `c-${idx}`;
                    return (
                      <button
                        key={k}
                        onClick={() => handleCopy(k, item.value)}
                        className="w-full text-left flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400">{item.label || "Copiar"}</div>
                          <div className="text-sm text-white truncate font-mono">{item.value}</div>
                        </div>
                        {copiedKey === k ? (
                          <Check className="w-4 h-4 text-green-400 shrink-0" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div>
                <h3 className="text-xs uppercase font-semibold text-gray-400 mb-2 tracking-wider">
                  Materiais de apoio
                </h3>
                <div className="space-y-2">
                  {attachments.map((a, idx) => (
                    <a
                      key={idx}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="truncate">{a.label || "Baixar arquivo"}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Helpful */}
            <div>
              <h3 className="text-xs uppercase font-semibold text-gray-400 mb-2 tracking-wider">
                Esse tutorial foi útil?
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleHelpful(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    myFeedback?.helpful === true
                      ? "bg-green-500/20 border-green-500/40 text-green-300"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  Sim ({helpfulCount})
                </button>
                <button
                  onClick={() => handleHelpful(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    myFeedback?.helpful === false
                      ? "bg-red-500/20 border-red-500/40 text-red-300"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  Não ({notHelpfulCount})
                </button>
              </div>
            </div>

            {/* Comments */}
            <div>
              <h3 className="text-xs uppercase font-semibold text-gray-400 mb-2 tracking-wider">
                Comentários ({comments.length})
              </h3>
              <div className="space-y-2 mb-3">
                <Textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder={myFeedback?.comment ? "Atualizar seu comentário..." : "Deixe seu comentário..."}
                  rows={2}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 resize-none"
                />
                <Button
                  onClick={handleSendComment}
                  disabled={!commentDraft.trim()}
                  size="sm"
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Enviar
                </Button>
              </div>
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Seja o primeiro a comentar.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex gap-2 bg-white/[0.03] border border-white/5 rounded-lg p-3">
                      {c.profile?.avatar_url ? (
                        <img src={c.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                          {(c.profile?.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">
                            {c.profile?.full_name || "Usuário"}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200 mt-0.5 whitespace-pre-wrap break-words">
                          {c.comment}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
