import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, ZoomIn, ZoomOut, RotateCw, Download, UserCircle, Hand, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// Default positions as % of image dimensions (based on CNH layout)
const DEFAULT_PHOTO = { xPct: 2.8, yPct: 25, wPct: 17.5, hPct: 24 }; // 3x4 white square
const DEFAULT_TEXT = {
  nome: { xPct: 30, yPct: 14.5 },
  nascimento: { xPct: 30, yPct: 22 },
  filiacao: { xPct: 30, yPct: 47 },
  assinatura: { xPct: 15, yPct: 56 },   // "ASSINATURA DO PORTADOR" field
};

const SIGNATURE_FONTS = [
  "Dancing Script",
  "Caveat",
  "Satisfy",
];

export default function AdminImageViewer() {
  const [images, setImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [photoOverlay, setPhotoOverlay] = useState<string | null>(null);
  const [photoPos, setPhotoPos] = useState(DEFAULT_PHOTO);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Main image pan
  const [panMode, setPanMode] = useState(false);
  const [mainOffset, setMainOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag state
  const [dragTarget, setDragTarget] = useState<string | null>(null); // "photo" | "nome" | "nascimento" | "filiacao"
  const [dragStartPx, setDragStartPx] = useState({ x: 0, y: 0 });
  const [dragStartPct, setDragStartPct] = useState({ x: 0, y: 0 });

  // Text positions as % of image
  const [textPos, setTextPos] = useState(DEFAULT_TEXT);

  // Font sizes
  const [fontSizes, setFontSizes] = useState({ nome: 11, nascimento: 10, filiacao: 9, assinatura: 14 });
  const [signatureFont, setSignatureFont] = useState(SIGNATURE_FONTS[0]);

  // Contrast
  const [contrast, setContrast] = useState(100);

  // Form fields
  const [formData, setFormData] = useState({
    nomeCompleto: "",
    dataNascimento: "",
    nomePai: "",
    nomeMae: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Get rendered image dimensions
  const getImgRect = () => {
    if (!imgRef.current) return null;
    return { w: imgRef.current.clientWidth, h: imgRef.current.clientHeight };
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id: crypto.randomUUID(), name: file.name, url }]);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (photoOverlay) URL.revokeObjectURL(photoOverlay);
    setPhotoOverlay(URL.createObjectURL(file));
    setPhotoPos(DEFAULT_PHOTO);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });
    if (selectedImage && images.find((i) => i.id === id)?.url === selectedImage) {
      setSelectedImage(null);
    }
  };

  const selectImage = (url: string) => {
    setSelectedImage(url);
    setZoom(1);
    setRotation(0);
    setMainOffset({ x: 0, y: 0 });
  };

  const downloadImage = () => {
    if (!selectedImage) return;
    const a = document.createElement("a");
    a.href = selectedImage;
    a.download = "imagem";
    a.click();
  };

  // --- Pan ---
  const onViewerMouseDown = (e: React.MouseEvent) => {
    if (!panMode) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - mainOffset.x, y: e.clientY - mainOffset.y });
  };

  // --- Drag start (photo or text) ---
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

  // Resize handle for photo
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        {/* Left: Upload + Form */}
        <div className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">Imagens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} className="w-full gap-2" variant="outline">
                <Upload className="size-4" />
                Upload de Imagem
              </Button>

              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              <Button onClick={() => photoInputRef.current?.click()} className="w-full gap-2" variant="outline">
                <UserCircle className="size-4" />
                Upload Foto 3x4
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

              {images.length === 0 && (
                <div className="text-center py-6 text-white/30 text-sm">Nenhuma imagem enviada</div>
              )}

              <div className="grid grid-cols-2 gap-2 max-h-[30vh] overflow-y-auto">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedImage === img.url ? "border-primary shadow-glow" : "border-white/10 hover:border-white/30"
                    }`}
                    onClick={() => selectImage(img.url)}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-24 object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      className="absolute top-1 right-1 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3 text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-0.5">
                      <span className="text-[10px] text-white/80 truncate block">{img.name}</span>
                    </div>
                  </div>
                ))}
              </div>
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
                <Label className="text-white/60 text-xs">Data de Nascimento</Label>
                <Input
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData((f) => ({ ...f, dataNascimento: e.target.value }))}
                  className="mt-1 bg-white/5 border-white/10 text-white"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-white/40">Fonte:</span>
                  <Slider value={[fontSizes.nascimento]} onValueChange={([v]) => setFontSizes((f) => ({ ...f, nascimento: v }))} min={5} max={18} step={0.5} className="flex-1" />
                  <span className="text-[10px] text-white/50 w-8">{fontSizes.nascimento}px</span>
                </div>
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
                    style={{
                      maxWidth: "100%",
                      maxHeight: "calc(70vh - 80px)",
                      objectFit: "contain",
                    }}
                  />

                  {/* Photo overlay - positioned by % */}
                  {photoOverlay && (
                    <div
                      className="absolute border border-black/30"
                      style={{
                        left: `${photoPos.xPct}%`,
                        top: `${photoPos.yPct}%`,
                        width: `${photoPos.wPct}%`,
                        height: `${photoPos.hPct}%`,
                        cursor: panMode ? "inherit" : "move",
                      }}
                      onMouseDown={(e) => onElementMouseDown("photo", e)}
                    >
                      <img src={photoOverlay} alt="Foto" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                      {!panMode && (
                        <div
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full cursor-se-resize"
                          onMouseDown={onResizeMouseDown}
                        />
                      )}
                    </div>
                  )}

                  {/* Text overlays - positioned by % */}
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
                  {formData.dataNascimento && (
                    <div
                      className="absolute select-none whitespace-nowrap"
                      style={{ left: `${textPos.nascimento.xPct}%`, top: `${textPos.nascimento.yPct}%`, cursor: panMode ? "inherit" : "move" }}
                      onMouseDown={(e) => onElementMouseDown("nascimento", e)}
                    >
                      <span className="font-semibold text-black/90" style={{ fontFamily: "Arial Narrow, Arial, sans-serif", fontSize: `${fontSizes.nascimento}px` }}>
                        {new Date(formData.dataNascimento).toLocaleDateString("pt-BR")}
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
                  {/* Assinatura overlay */}
                  {formData.nomeCompleto && (
                    <div
                      className="absolute select-none whitespace-nowrap"
                      style={{ left: `${textPos.assinatura.xPct}%`, top: `${textPos.assinatura.yPct}%`, cursor: panMode ? "inherit" : "move" }}
                      onMouseDown={(e) => onElementMouseDown("assinatura", e)}
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
                  <ZoomIn className="size-10" />
                  <span>Clique em uma imagem para visualizar</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
