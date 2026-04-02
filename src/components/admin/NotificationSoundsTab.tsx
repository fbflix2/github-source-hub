import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Volume2, Upload, Trash2, Play, Pause, Loader2, ShoppingCart, Wallet, Headphones, MessageCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface SoundRow {
  id: string;
  event_key: string;
  label: string;
  sound_url: string | null;
  file_name: string | null;
  active: boolean;
}

const eventIcons: Record<string, typeof ShoppingCart> = {
  order_completed: ShoppingCart,
  wallet_deposit: Wallet,
  new_ticket: Headphones,
  team_chat: MessageCircle,
};

const eventColors: Record<string, string> = {
  order_completed: "text-green-400 bg-green-500/15",
  wallet_deposit: "text-yellow-400 bg-yellow-500/15",
  new_ticket: "text-blue-400 bg-blue-500/15",
  team_chat: "text-purple-400 bg-purple-500/15",
};

export default function NotificationSoundsTab() {
  const [sounds, setSounds] = useState<SoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchSounds = async () => {
    const { data } = await supabase
      .from("notification_sounds")
      .select("*")
      .order("created_at");
    if (data) setSounds(data as SoundRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchSounds();
  }, []);

  const handleUpload = async (eventKey: string, file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Apenas arquivos de áudio são permitidos (MP3, WAV, OGG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 5MB)");
      return;
    }

    setUploading(eventKey);

    // Remove old file if exists
    const existing = sounds.find(s => s.event_key === eventKey);
    if (existing?.sound_url) {
      const oldPath = existing.sound_url.split("/notification-sounds/").pop();
      if (oldPath) await supabase.storage.from("notification-sounds").remove([oldPath]);
    }

    const ext = file.name.split(".").pop();
    const fileName = `${eventKey}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("notification-sounds").upload(fileName, file);
    if (uploadError) {
      toast.error("Erro ao fazer upload");
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("notification-sounds").getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("notification_sounds")
      .update({ sound_url: urlData.publicUrl, file_name: file.name })
      .eq("event_key", eventKey);

    if (updateError) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Som atualizado!");
    }
    setUploading(null);
    fetchSounds();
  };

  const handleRemoveSound = async (row: SoundRow) => {
    if (row.sound_url) {
      const path = row.sound_url.split("/notification-sounds/").pop();
      if (path) await supabase.storage.from("notification-sounds").remove([path]);
    }
    await supabase
      .from("notification_sounds")
      .update({ sound_url: null, file_name: null })
      .eq("event_key", row.event_key);
    toast.success("Som removido!");
    fetchSounds();
  };

  const handleToggleActive = async (row: SoundRow) => {
    await supabase
      .from("notification_sounds")
      .update({ active: !row.active })
      .eq("event_key", row.event_key);
    fetchSounds();
  };

  const handlePlay = (url: string, eventKey: string) => {
    if (playing === eventKey) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.onended = () => setPlaying(null);
    audio.play();
    audioRef.current = audio;
    setPlaying(eventKey);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/15">
            <Volume2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Sons de Notificação</h2>
            <p className="text-sm text-gray-400">Faça upload de arquivos de áudio (MP3, WAV) para cada tipo de evento.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {sounds.map((row) => {
            const Icon = eventIcons[row.event_key] || Volume2;
            const colorClass = eventColors[row.event_key] || "text-gray-400 bg-gray-500/15";
            const isUploading = uploading === row.event_key;
            const isPlaying = playing === row.event_key;

            return (
              <div
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                {/* Event info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className={`p-2.5 rounded-xl ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{row.label}</p>
                    <p className="text-xs text-gray-500 font-mono">{row.event_key}</p>
                  </div>
                </div>

                {/* Sound file info + actions */}
                <div className="flex-1 flex items-center gap-3">
                  {row.sound_url ? (
                    <>
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                        <Volume2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-300 truncate">{row.file_name || "audio.mp3"}</span>
                      </div>
                      <button
                        onClick={() => handlePlay(row.sound_url!, row.event_key)}
                        className={`p-2 rounded-lg transition-colors ${
                          isPlaying
                            ? "bg-primary/20 text-primary"
                            : "bg-white/[0.05] text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                        title={isPlaying ? "Pausar" : "Ouvir"}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRemoveSound(row)}
                        className="p-2 rounded-lg bg-white/[0.05] text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remover som"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 italic flex-1">Nenhum som configurado</span>
                  )}
                </div>

                {/* Upload + toggle */}
                <div className="flex items-center gap-3">
                  <input
                    ref={(el) => { fileInputRefs.current[row.event_key] = el; }}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(row.event_key, f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRefs.current[row.event_key]?.click()}
                    className="gap-2 text-xs border-white/10 hover:bg-white/5"
                  >
                    {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {row.sound_url ? "Trocar" : "Upload"}
                  </Button>
                  <Switch
                    checked={row.active}
                    onCheckedChange={() => handleToggleActive(row)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
