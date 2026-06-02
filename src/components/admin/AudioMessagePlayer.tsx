import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, AlertCircle, Headphones } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface AudioMessagePlayerProps {
  src: string;
  className?: string;
  variant?: "sent" | "received";
}

export function AudioMessagePlayer({ src, className, variant = "received" }: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const isSent = variant === "sent";

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.preload = "metadata";

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setLoading(false);
    };
    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      audio.currentTime = 0;
    };
    const onError = () => {
      setError(true);
      setLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if (audio.readyState >= 1) onLoadedMetadata();

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || error) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.volume = isMuted ? 0 : volume;
      audio.play().catch(() => {
        setError(true);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [isPlaying, error, volume, isMuted]);

  const handleProgressChange = useCallback((val: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = val[0] * duration;
    audio.currentTime = newTime;
    setProgress(val[0]);
  }, [duration]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !isMuted;
    audio.volume = next ? 0 : volume;
    setIsMuted(next);
  }, [isMuted, volume]);

  const handleVolumeChange = useCallback((val: number[]) => {
    const audio = audioRef.current;
    const v = val[0];
    setVolume(v);
    setIsMuted(v === 0);
    if (audio) audio.volume = v;
  }, []);

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-destructive", className)}>
        <AlertCircle className="size-4 shrink-0" />
        <span>Áudio indisponível</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-2.5 py-1.5 min-w-[220px] max-w-full select-none",
        isPlaying
          ? isSent ? "bg-green-800/50" : "bg-muted-foreground/20"
          : isSent ? "bg-green-800/30" : "bg-muted-foreground/10",
        className
      )}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        className={cn(
          "shrink-0 rounded-full flex items-center justify-center size-8 transition-colors disabled:opacity-50",
          isSent
            ? "bg-white/90 hover:bg-white text-green-700"
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
        )}
        aria-label={isPlaying ? "Pausar" : "Reproduzir"}
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <Headphones className={cn("size-3.5 shrink-0", isSent ? "text-white/70" : "text-muted-foreground")} />
          <span className={cn("text-[11px] tabular-nums", isSent ? "text-white/90" : "text-muted-foreground")}>
            {formatTime(progress * duration)} / {formatTime(duration)}
          </span>
        </div>
        <Slider
          value={[progress]}
          max={1}
          step={0.001}
          onValueChange={handleProgressChange}
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={toggleMute}
          className={cn(
            "transition-colors",
            isSent ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={isMuted ? "Ativar som" : "Silenciar"}
        >
          {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <div className="w-16 hidden sm:block">
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.05}
            onValueChange={handleVolumeChange}
          />
        </div>
      </div>
    </div>
  );
}
