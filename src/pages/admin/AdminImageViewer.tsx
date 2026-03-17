import { useState, useRef, useEffect, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download, UserCircle, Hand, MousePointer, Settings, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const SETTINGS_KEY = "imageviewer_base_template_url";
const POSITIONS_KEY = "imageviewer_positions";
const DOC_IDENTIDADE_KEY = "imageviewer_doc_identidade";
const DEFAULT_DOC_IDENTIDADE = "503234175 SSPSP";

const DEFAULT_PHOTO = { xPct: 2.8, yPct: 25, wPct: 17.5, hPct: 24 };
const DEFAULT_TEXT = {
  nome: { xPct: 30, yPct: 14.5 },
  docIdentidade: { xPct: 30, yPct: 18 },
  nascimento: { xPct: 30, yPct: 22 },
  filiacao: { xPct: 30, yPct: 47 },
  assinatura: { xPct: 15, yPct: 56 },
};

const SIGNATURE_FONTS = ["Dancing Script", "Caveat", "Satisfy"];

export default function AdminImageViewer() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [photoOverlay, setPhotoOverlay] = useState<string | null>(null);
  const [photoPos, setPhotoPos] = useState(DEFAULT_PHOTO);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);

  const [panMode, setPanMode] = useState(false);
  const [mainOffset, setMainOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragStartPx, setDragStartPx] = useState({ x: 0, y: 0 });
  const [dragStartPct, setDragStartPct] = useState({ x: 0, y: 0 });

  const [textPos, setTextPos] = useState(DEFAULT_TEXT);
  const [fontSizes, setFontSizes] = useState({ nome: 11, docIdentidade: 9, nascimento: 10, filiacao: 9, assinatura: 14 });
  const [docIdentidade, setDocIdentidade] = useState(DEFAULT_DOC_IDENTIDADE);
  const [signatureFont, setSignatureFont] = useState(SIGNATURE_FONTS[0]);
  const [contrast, setContrast] = useState(100);

  const [formData, setFormData] = useState({
    nomeCompleto: "",
    dataNascimento: "",
    naturalidade: "",
    uf: "",
    nomePai: "",
    nomeMae: "",
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [templateLoading, setTemplateLoading] = useState(true);

  // Load template + positions from Supabase on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("key, value")
          .in("key", [SETTINGS_KEY, POSITIONS_KEY, DOC_IDENTIDADE_KEY]);

        if (data) {
          for (const row of data) {
            if (row.key === SETTINGS_KEY && row.value) {
              setSelectedImage(row.value);
              setTemplatePreview(row.value);
            }
            if (row.key === POSITIONS_KEY && row.value) {
              try {
                const saved = JSON.parse(row.value);
                if (saved.textPos) setTextPos(saved.textPos);
                if (saved.fontSizes) setFontSizes(saved.fontSizes);
                if (saved.photoPos) setPhotoPos(saved.photoPos);
                if (saved.signatureFont) setSignatureFont(saved.signatureFont);
                if (saved.contrast != null) setContrast(saved.contrast);
              } catch { /* ignore parse errors */ }
            }
            if (row.key === DOC_IDENTIDADE_KEY && row.value) {
              setDocIdentidade(row.value);
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setTemplateLoading(false);
      }
    };
    loadSettings();
  }, []);

  const getImgRect = () => {
    if (!imgRef.current) return null;
    return { w: imgRef.current.clientWidth, h: imgRef.current.clientHeight };
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setTemplateLoading(true);
    try {
      // Upload to Supabase storage
      const ext = file.name.split(".").pop() || "png";
      const path = `templates/base_template_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Save URL in site_settings
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (existing) {
        await supabase.from("site_settings").update({ value: publicUrl }).eq("key", SETTINGS_KEY);
      } else {
        await supabase.from("site_settings").insert({ key: SETTINGS_KEY, value: publicUrl });
      }

      setSelectedImage(publicUrl);
      setTemplatePreview(publicUrl);
      setZoom(1);
      setRotation(0);
      setMainOffset({ x: 0, y: 0 });
      toast.success("Template base salvo permanentemente!");
    } catch (err: any) {
      toast.error("Erro ao salvar template: " + err.message);
    } finally {
      setTemplateLoading(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  };

  const removeTemplate = async () => {
    try {
      await supabase.from("site_settings").delete().eq("key", SETTINGS_KEY);
      await supabase.from("site_settings").delete().eq("key", POSITIONS_KEY);
      await supabase.from("site_settings").delete().eq("key", DOC_IDENTIDADE_KEY);
      setSelectedImage(null);
      setTemplatePreview(null);
      setTextPos(DEFAULT_TEXT);
      setFontSizes({ nome: 11, docIdentidade: 9, nascimento: 10, filiacao: 9, assinatura: 14 });
      setPhotoPos(DEFAULT_PHOTO);
      setContrast(100);
      setSignatureFont(SIGNATURE_FONTS[0]);
      setDocIdentidade(DEFAULT_DOC_IDENTIDADE);
      toast.success("Template removido");
    } catch {
      toast.error("Erro ao remover template");
    }
  };

  const savePositions = useCallback(async (silent = false) => {
    try {
      const payload = JSON.stringify({ textPos, fontSizes, photoPos, signatureFont, contrast });
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", POSITIONS_KEY)
        .maybeSingle();

      if (existing) {
        await supabase.from("site_settings").update({ value: payload }).eq("key", POSITIONS_KEY);
      } else {
        await supabase.from("site_settings").insert({ key: POSITIONS_KEY, value: payload });
      }
      if (!silent) toast.success("Posições salvas permanentemente!");
    } catch {
      if (!silent) toast.error("Erro ao salvar posições");
    }
  }, [textPos, fontSizes, photoPos, signatureFont, contrast]);

  // Auto-save positions after changes (debounced)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (templateLoading) return; // Don't save during initial load
    if (!selectedImage) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      savePositions(true);
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [textPos, fontSizes, photoPos, signatureFont, contrast, selectedImage, templateLoading, savePositions]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (photoOverlay) URL.revokeObjectURL(photoOverlay);
    setPhotoOverlay(URL.createObjectURL(file));
    setPhotoPos(DEFAULT_PHOTO);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const downloadImage = async () => {
    if (!selectedImage) return;

    const baseImg = new Image();
    baseImg.crossOrigin = "anonymous";
    baseImg.src = selectedImage;
    await new Promise<void>((res, rej) => { baseImg.onload = () => res(); baseImg.onerror = rej; });

    const W = baseImg.naturalWidth;
    const H = baseImg.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Apply contrast
    ctx.filter = `contrast(${contrast}%)`;
    ctx.drawImage(baseImg, 0, 0, W, H);
    ctx.filter = "none";

    // Draw photo overlay with object-fit: cover behavior
    if (photoOverlay) {
      const pImg = new Image();
      pImg.crossOrigin = "anonymous";
      pImg.src = photoOverlay;
      await new Promise<void>((res) => { pImg.onload = () => res(); pImg.onerror = () => res(); });
      const dx = (photoPos.xPct / 100) * W;
      const dy = (photoPos.yPct / 100) * H;
      const dw = (photoPos.wPct / 100) * W;
      const dh = (photoPos.hPct / 100) * H;
      // Replicate CSS object-fit: cover
      const imgAspect = pImg.naturalWidth / pImg.naturalHeight;
      const destAspect = dw / dh;
      let sx: number, sy: number, sw: number, sh: number;
      if (imgAspect > destAspect) {
        sh = pImg.naturalHeight;
        sw = sh * destAspect;
        sx = (pImg.naturalWidth - sw) / 2;
        sy = 0;
      } else {
        sw = pImg.naturalWidth;
        sh = sw / destAspect;
        sx = 0;
        sy = (pImg.naturalHeight - sh) / 2;
      }
      ctx.drawImage(pImg, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    // Helper to compute font size scaled to natural resolution
    const scaledFont = (sizePx: number) => {
      const imgRect = getImgRect();
      if (!imgRect) return sizePx;
      return sizePx * (W / imgRect.w);
    };

    // Use textBaseline 'top' to match CSS top positioning
    ctx.textBaseline = "top";

    // Draw nome
    if (formData.nomeCompleto) {
      const fs = scaledFont(fontSizes.nome);
      ctx.font = `bold ${fs}px "Arial Narrow", Arial, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.letterSpacing = "0.05em";
      const x = (textPos.nome.xPct / 100) * W;
      const y = (textPos.nome.yPct / 100) * H;
      ctx.fillText(formData.nomeCompleto.toUpperCase(), x, y);
    }

    // Draw doc identidade
    if (docIdentidade) {
      const fs = scaledFont(fontSizes.docIdentidade);
      ctx.font = `600 ${fs}px "Arial Narrow", Arial, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      const x = (textPos.docIdentidade.xPct / 100) * W;
      const y = (textPos.docIdentidade.yPct / 100) * H;
      ctx.fillText(docIdentidade.toUpperCase(), x, y);
    }

    // Draw nascimento + naturalidade
    if (formData.dataNascimento || formData.naturalidade) {
      const fs = scaledFont(fontSizes.nascimento);
      ctx.font = `600 ${fs}px "Arial Narrow", Arial, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      const x = (textPos.nascimento.xPct / 100) * W;
      const y = (textPos.nascimento.yPct / 100) * H;
      const parts: string[] = [];
      if (formData.dataNascimento) parts.push(new Date(formData.dataNascimento).toLocaleDateString("pt-BR"));
      if (formData.naturalidade) parts.push(formData.naturalidade);
      if (formData.uf) parts.push(formData.uf);
      ctx.fillText(parts.join(" - "), x, y);
    }

    // Draw filiação
    if (formData.nomePai || formData.nomeMae) {
      const fs = scaledFont(fontSizes.filiacao);
      ctx.font = `600 ${fs}px "Arial Narrow", Arial, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      const x = (textPos.filiacao.xPct / 100) * W;
      let y = (textPos.filiacao.yPct / 100) * H;
      if (formData.nomePai) { ctx.fillText(formData.nomePai.toUpperCase(), x, y); y += fs * 1.2; }
      if (formData.nomeMae) { ctx.fillText(formData.nomeMae.toUpperCase(), x, y); }
    }

    // Draw assinatura
    if (formData.nomeCompleto) {
      const fs = scaledFont(fontSizes.assinatura);
      ctx.font = `${fs}px "${signatureFont}", cursive`;
      ctx.fillStyle = "#1a1a8a";
      const x = (textPos.assinatura.xPct / 100) * W;
      const y = (textPos.assinatura.yPct / 100) * H;
      ctx.fillText(formData.nomeCompleto, x, y);
    }

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documento_${formData.nomeCompleto?.replace(/\s+/g, "_") || "imagem"}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Imagem exportada com sucesso!");
    }, "image/png");
  };

  const onViewerMouseDown = (e: React.MouseEvent) => {
    if (!panMode) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - mainOffset.x, y: e.clientY - mainOffset.y });
  };

  const onElementMouseDown = (target: string, e: React.MouseEvent) => {
    if (panMode) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = getImgRect();
    if (!rect) return;
    setDragTarget(target);
    setDragStartPx({ x: e.clientX, y: e.clientY });
    if (target === "photo") {
      setDragStartPct({ x: photoPos.xPct, y: photoPos.yPct });
    } else {
      const pos = textPos[target as keyof typeof textPos];
      setDragStartPct({ x: pos.xPct, y: pos.yPct });
    }
  };

  const onGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setMainOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (!dragTarget) return;
    const rect = getImgRect();
    if (!rect) return;
    const dx = (e.clientX - dragStartPx.x) / zoom;
    const dy = (e.clientY - dragStartPx.y) / zoom;
    const dxPct = (dx / rect.w) * 100;
    const dyPct = (dy / rect.h) * 100;
    if (dragTarget === "photo") {
      setPhotoPos((p) => ({ ...p, xPct: dragStartPct.x + dxPct, yPct: dragStartPct.y + dyPct }));
    } else {
      setTextPos((prev) => ({
        ...prev,
        [dragTarget]: { xPct: dragStartPct.x + dxPct, yPct: dragStartPct.y + dyPct },
      }));
    }
  }, [isPanning, panStart, dragTarget, dragStartPx, dragStartPct, zoom]);

  const onGlobalMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragTarget(null);
  }, []);

  useEffect(() => {
    if (isPanning || dragTarget) {
      window.addEventListener("mousemove", onGlobalMouseMove);
      window.addEventListener("mouseup", onGlobalMouseUp);
      return () => {
        window.removeEventListener("mousemove", onGlobalMouseMove);
        window.removeEventListener("mouseup", onGlobalMouseUp);
      };
    }
  }, [isPanning, dragTarget, onGlobalMouseMove, onGlobalMouseUp]);

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = photoPos.wPct;
    const startH = photoPos.hPct;
    const rect = getImgRect();
    if (!rect) return;
    const handleMove = (ev: MouseEvent) => {
      const dxPct = ((ev.clientX - startX) / zoom / rect.w) * 100;
      const dyPct = ((ev.clientY - startY) / zoom / rect.h) * 100;
      setPhotoPos((p) => ({ ...p, wPct: Math.max(5, startW + dxPct), hPct: Math.max(5, startH + dyPct) }));
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Visualizador de Imagens</h1>
          <p className="text-white/50 text-sm">Faça upload e visualize imagens em tamanho real</p>
        </div>
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setSettingsOpen(true)} title="Configurações do Template">
          <Settings className="size-5 text-white/70" />
        </Button>
      </div>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Configurações do Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina a imagem base que será usada como template para todos os documentos. Ela ficará salva permanentemente.
            </p>
            <input ref={templateInputRef} type="file" accept="image/*" onChange={handleTemplateUpload} className="hidden" />
            <Button onClick={() => templateInputRef.current?.click()} className="w-full gap-2" variant="outline">
              <Settings className="size-4" />
              {templatePreview ? "Trocar Template Base" : "Enviar Template Base"}
            </Button>
            {templatePreview && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Template atual:</Label>
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={templatePreview} alt="Template" className="w-full h-48 object-contain bg-black/20" />
                  <button
                    onClick={removeTemplate}
                    className="absolute top-2 right-2 bg-destructive rounded-full p-1 hover:bg-destructive/80 transition-colors"
                  >
                    <X className="size-4 text-white" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">Este template será carregado automaticamente ao abrir esta página.</p>
              </div>
            )}
            {templatePreview && (
              <div className="pt-2 border-t border-border space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Doc. de Identidade (padrão)</Label>
                  <Input
                    value={docIdentidade}
                    onChange={(e) => setDocIdentidade(e.target.value)}
                    onBlur={async () => {
                      try {
                        const { data: existing } = await supabase.from("site_settings").select("id").eq("key", DOC_IDENTIDADE_KEY).maybeSingle();
                        if (existing) {
                          await supabase.from("site_settings").update({ value: docIdentidade }).eq("key", DOC_IDENTIDADE_KEY);
                        } else {
                          await supabase.from("site_settings").insert({ key: DOC_IDENTIDADE_KEY, value: docIdentidade });
                        }
                        toast.success("Doc. identidade salvo!");
                      } catch { toast.error("Erro ao salvar"); }
                    }}
                    placeholder="503234175 SSPSP"
                    className="mt-1"
                    maxLength={50}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Este valor será preenchido automaticamente em novos documentos.</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Posicione os textos e a foto no preview arrastando-os, ajuste fontes e contraste, depois clique abaixo para salvar as posições permanentemente.
                </p>
                <Button onClick={() => savePositions(false)} variant="outline" className="w-full gap-2">
                  <Download className="size-4" />
                  Salvar Posições Atuais
                </Button>
              </div>
            )}
            {!templatePreview && (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                Nenhum template configurado
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        {/* Left: Upload Foto + Form */}
        <div className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">Foto & Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              <Button onClick={() => photoInputRef.current?.click()} className="w-full gap-2" variant="outline">
                <UserCircle className="size-4" />
                Upload Foto 3×4
              </Button>
              {photoOverlay && (
                <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                  <img src={photoOverlay} alt="Foto" className="w-10 h-12 object-cover rounded border border-white/20" />
                  <span className="text-xs text-white/60 flex-1">Posicionada automaticamente</span>
                  <button onClick={() => { URL.revokeObjectURL(photoOverlay); setPhotoOverlay(null); }}>
                    <X className="size-4 text-white/40 hover:text-white" />
                  </button>
                </div>
              )}
              {!templatePreview && (
                <div className="text-center py-4 text-white/30 text-xs border border-dashed border-white/10 rounded-lg">
                  Nenhum template configurado.<br />
                  <button onClick={() => setSettingsOpen(true)} className="text-primary underline mt-1">Configurar template</button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Dados do Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-white/60 text-xs">Nome Completo</Label>
                <Input
                  value={formData.nomeCompleto}
                  onChange={(e) => setFormData((f) => ({ ...f, nomeCompleto: e.target.value }))}
                  placeholder="NOME COMPLETO"
                  className="mt-1 bg-white/5 border-white/10 text-white uppercase"
                  maxLength={100}
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-white/40">Fonte:</span>
                  <Slider value={[fontSizes.nome]} onValueChange={([v]) => setFontSizes((f) => ({ ...f, nome: v }))} min={5} max={18} step={0.5} className="flex-1" />
                  <span className="text-[10px] text-white/50 w-8">{fontSizes.nome}px</span>
                </div>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Doc. de Identidade</Label>
                <Input
                  value={docIdentidade}
                  onChange={(e) => setDocIdentidade(e.target.value)}
                  placeholder="503234175 SSPSP"
                  className="mt-1 bg-white/5 border-white/10 text-white uppercase text-xs"
                  maxLength={50}
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-white/40">Fonte:</span>
                  <Slider value={[fontSizes.docIdentidade]} onValueChange={([v]) => setFontSizes((f) => ({ ...f, docIdentidade: v }))} min={5} max={18} step={0.5} className="flex-1" />
                  <span className="text-[10px] text-white/50 w-8">{fontSizes.docIdentidade}px</span>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <Label className="text-white/60 text-xs">Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.dataNascimento}
                    onChange={(e) => setFormData((f) => ({ ...f, dataNascimento: e.target.value }))}
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="w-16">
                  <Label className="text-white/60 text-xs">UF</Label>
                  <Input
                    value={formData.uf}
                    onChange={(e) => setFormData((f) => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                    placeholder="SP"
                    className="mt-1 bg-white/5 border-white/10 text-white uppercase text-xs text-center"
                    maxLength={2}
                  />
                </div>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Local de Nascimento</Label>
                <Input
                  value={formData.naturalidade}
                  onChange={(e) => setFormData((f) => ({ ...f, naturalidade: e.target.value }))}
                  placeholder="São Paulo"
                  className="mt-1 bg-white/5 border-white/10 text-white text-xs"
                  maxLength={100}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40">Fonte nasc.:</span>
                <Slider value={[fontSizes.nascimento]} onValueChange={([v]) => setFontSizes((f) => ({ ...f, nascimento: v }))} min={5} max={18} step={0.5} className="flex-1" />
                <span className="text-[10px] text-white/50 w-8">{fontSizes.nascimento}px</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-white/60 text-xs">Nome do Pai</Label>
                  <Input
                    value={formData.nomePai}
                    onChange={(e) => setFormData((f) => ({ ...f, nomePai: e.target.value }))}
                    placeholder="Nome do Pai"
                    className="mt-1 bg-white/5 border-white/10 text-white uppercase text-xs"
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label className="text-white/60 text-xs">Nome da Mãe</Label>
                  <Input
                    value={formData.nomeMae}
                    onChange={(e) => setFormData((f) => ({ ...f, nomeMae: e.target.value }))}
                    placeholder="Nome da Mãe"
                    className="mt-1 bg-white/5 border-white/10 text-white uppercase text-xs"
                    maxLength={100}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-[10px] text-white/40">Fonte filiação:</span>
                  <Slider value={[fontSizes.filiacao]} onValueChange={([v]) => setFontSizes((f) => ({ ...f, filiacao: v }))} min={5} max={18} step={0.5} className="flex-1" />
                  <span className="text-[10px] text-white/50 w-8">{fontSizes.filiacao}px</span>
                </div>
              </div>

              {/* Assinatura */}
              <div className="pt-2 border-t border-white/10">
                <Label className="text-white/60 text-xs">Assinatura (gerada do nome)</Label>
                {formData.nomeCompleto && (
                  <div className="mt-1 p-2 bg-white/5 rounded border border-white/10">
                    <span style={{ fontFamily: `'${signatureFont}', cursive`, fontSize: `${fontSizes.assinatura}px`, color: "#1a1a8a" }}>
                      {formData.nomeCompleto}
                    </span>
                  </div>
                )}
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {SIGNATURE_FONTS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setSignatureFont(f)}
                      className={`px-2 py-1 rounded text-xs border transition-all ${signatureFont === f ? "border-primary bg-primary/20 text-white" : "border-white/10 text-white/50 hover:border-white/30"}`}
                      style={{ fontFamily: `'${f}', cursive` }}
                    >
                      Aa
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-white/40">Tamanho:</span>
                  <Slider value={[fontSizes.assinatura]} onValueChange={([v]) => setFontSizes((sf) => ({ ...sf, assinatura: v }))} min={8} max={24} step={0.5} className="flex-1" />
                  <span className="text-[10px] text-white/50 w-8">{fontSizes.assinatura}px</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Label className="text-white/60 text-xs whitespace-nowrap">Contraste</Label>
                  <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={50} max={200} step={1} className="flex-1" />
                  <span className="text-[10px] text-white/50 w-10">{contrast}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Full-size viewer */}
        <Card className="bg-white/5 border-white/10 min-h-[70vh]">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-white text-sm">Visualização</CardTitle>
            {selectedImage && (
              <div className="flex items-center gap-1">
                <Button size="icon" variant={!panMode ? "default" : "ghost"} className="size-8" onClick={() => setPanMode(false)} title="Selecionar">
                  <MousePointer className="size-4" />
                </Button>
                <Button size="icon" variant={panMode ? "default" : "ghost"} className="size-8" onClick={() => setPanMode(true)} title="Mover">
                  <Hand className="size-4" />
                </Button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <Button size="icon" variant="ghost" className="size-8" onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}>
                  <ZoomOut className="size-4 text-white/70" />
                </Button>
                <span className="text-white/50 text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => setZoom((z) => Math.min(5, z + 0.25))}>
                  <ZoomIn className="size-4 text-white/70" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => setRotation((r) => r + 90)}>
                  <RotateCw className="size-4 text-white/70" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={downloadImage}>
                  <Download className="size-4 text-white/70" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent
            className="overflow-hidden h-[calc(70vh-60px)]"
            style={{ cursor: panMode ? (isPanning ? "grabbing" : "grab") : "default" }}
            onMouseDown={onViewerMouseDown}
          >
            {selectedImage ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `translate(${mainOffset.x}px, ${mainOffset.y}px)`,
                  transition: isPanning ? "none" : "transform 0.15s",
                }}
              >
                <div
                  className="relative inline-block"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: "center center",
                    transition: "transform 0.2s",
                    filter: `contrast(${contrast}%)`,
                  }}
                >
                  <img
                    ref={imgRef}
                    src={selectedImage}
                    alt="Visualização"
                    className="select-none"
                    draggable={false}
                    style={{ maxWidth: "100%", maxHeight: "calc(70vh - 80px)", objectFit: "contain" }}
                  />

                  {photoOverlay && (
                    <div
                      className="absolute border border-blue-400/50"
                      style={{
                        left: `${photoPos.xPct}%`,
                        top: `${photoPos.yPct}%`,
                        width: `${photoPos.wPct}%`,
                        height: `${photoPos.hPct}%`,
                        cursor: panMode ? "inherit" : "move",
                      }}
                      onMouseDown={(e) => onElementMouseDown("photo", e)}
                    >
                      <img src={photoOverlay} alt="Foto" className="w-full h-full object-cover" draggable={false} />
                      {/* Resize handle */}
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize rounded-tl"
                        onMouseDown={onResizeMouseDown}
                      />
                    </div>
                  )}

                  {formData.nomeCompleto && (
                    <div
                      className="absolute select-none whitespace-nowrap"
                      style={{ left: `${textPos.nome.xPct}%`, top: `${textPos.nome.yPct}%`, cursor: panMode ? "inherit" : "move" }}
                      onMouseDown={(e) => onElementMouseDown("nome", e)}
                    >
                      <span className="font-bold tracking-wide text-black/90 uppercase" style={{ fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: `${fontSizes.nome}px` }}>
                        {formData.nomeCompleto}
                      </span>
                    </div>
                  )}
                  {docIdentidade && (
                    <div
                      className="absolute select-none whitespace-nowrap"
                      style={{ left: `${textPos.docIdentidade.xPct}%`, top: `${textPos.docIdentidade.yPct}%`, cursor: panMode ? "inherit" : "move" }}
                      onMouseDown={(e) => onElementMouseDown("docIdentidade", e)}
                    >
                      <span className="font-semibold text-black/90 uppercase" style={{ fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: `${fontSizes.docIdentidade}px` }}>
                        {docIdentidade}
                      </span>
                    </div>
                  )}
                  {(formData.dataNascimento || formData.naturalidade) && (
                    <div
                      className="absolute select-none whitespace-nowrap"
                      style={{ left: `${textPos.nascimento.xPct}%`, top: `${textPos.nascimento.yPct}%`, cursor: panMode ? "inherit" : "move" }}
                      onMouseDown={(e) => onElementMouseDown("nascimento", e)}
                    >
                      <span className="font-semibold text-black/90" style={{ fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: `${fontSizes.nascimento}px` }}>
                        {[
                          formData.dataNascimento ? new Date(formData.dataNascimento).toLocaleDateString("pt-BR") : "",
                          formData.naturalidade,
                          formData.uf
                        ].filter(Boolean).join(" - ")}
                      </span>
                    </div>
                  )}
                  {(formData.nomePai || formData.nomeMae) && (
                    <div
                      className="absolute select-none flex flex-col"
                      style={{ left: `${textPos.filiacao.xPct}%`, top: `${textPos.filiacao.yPct}%`, cursor: panMode ? "inherit" : "move" }}
                      onMouseDown={(e) => onElementMouseDown("filiacao", e)}
                    >
                      {formData.nomePai && (
                        <span className="font-semibold text-black/90 uppercase whitespace-nowrap" style={{ fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: `${fontSizes.filiacao}px` }}>
                          {formData.nomePai}
                        </span>
                      )}
                      {formData.nomeMae && (
                        <span className="font-semibold text-black/90 uppercase whitespace-nowrap" style={{ fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: `${fontSizes.filiacao}px` }}>
                          {formData.nomeMae}
                        </span>
                      )}
                    </div>
                  )}
                  {formData.nomeCompleto && (
                    <div
                      className="absolute select-none whitespace-nowrap pointer-events-none"
                      style={{ left: `${textPos.assinatura.xPct}%`, top: `${textPos.assinatura.yPct}%` }}
                    >
                      <span style={{ fontFamily: `'${signatureFont}', cursive`, fontSize: `${fontSizes.assinatura}px`, color: "#1a1a8a" }}>
                        {formData.nomeCompleto}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-white/20 text-sm flex flex-col items-center gap-2">
                  <Settings className="size-10" />
                  <span>Configure o template base nas configurações</span>
                  <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} className="mt-2">
                    <Settings className="size-4 mr-2" /> Abrir Configurações
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}