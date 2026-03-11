import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, ZoomIn, ZoomOut, RotateCw, Download, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminImageViewer() {
  const [images, setImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [photoOverlay, setPhotoOverlay] = useState<string | null>(null);
  const [photoPosition, setPhotoPosition] = useState({ x: 0, y: 0 });
  const [photoSize, setPhotoSize] = useState({ w: 120, h: 150 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

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
    setPhotoPosition({ x: 50, y: 150 });
    setPhotoSize({ w: 120, h: 150 });
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
  };

  const downloadImage = () => {
    if (!selectedImage) return;
    const a = document.createElement("a");
    a.href = selectedImage;
    a.download = "imagem";
    a.click();
  };

  // Drag photo overlay
  const onPhotoMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX - photoPosition.x, y: e.clientY - photoPosition.y });
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPhotoPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }
  }, [isDragging, isResizing, onMouseMove, onMouseUp]);

  // Resize handle
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = photoSize.w;
    const startH = photoSize.h;

    const handleMove = (ev: MouseEvent) => {
      const dw = ev.clientX - startX;
      const dh = ev.clientY - startY;
      setPhotoSize({ w: Math.max(40, startW + dw), h: Math.max(50, startH + dh) });
    };
    const handleUp = () => {
      setIsResizing(false);
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
        {/* Left: Upload + Thumbnails */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">Imagens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} className="w-full gap-2" variant="outline">
              <Upload className="size-4" />
              Upload de Imagem
            </Button>

            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <Button onClick={() => photoInputRef.current?.click()} className="w-full gap-2" variant="outline">
              <UserCircle className="size-4" />
              Upload Foto (sobrepor)
            </Button>

            {photoOverlay && (
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                <img src={photoOverlay} alt="Foto" className="w-10 h-12 object-cover rounded border border-white/20" />
                <span className="text-xs text-white/60 flex-1">Foto carregada - arraste na imagem</span>
                <button onClick={() => { URL.revokeObjectURL(photoOverlay); setPhotoOverlay(null); }}>
                  <X className="size-4 text-white/40 hover:text-white" />
                </button>
              </div>
            )}

            {images.length === 0 && (
              <div className="text-center py-10 text-white/30 text-sm">Nenhuma imagem enviada</div>
            )}

            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedImage === img.url ? "border-primary shadow-glow" : "border-white/10 hover:border-white/30"
                  }`}
                  onClick={() => selectImage(img.url)}
                >
                  <img src={img.url} alt={img.name} className="w-full h-28 object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3 text-white" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                    <span className="text-[10px] text-white/80 truncate block">{img.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Full-size viewer */}
        <Card className="bg-white/5 border-white/10 min-h-[70vh]">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-white text-sm">Visualização</CardTitle>
            {selectedImage && (
              <div className="flex items-center gap-1">
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
          <CardContent className="flex items-center justify-center overflow-auto h-[calc(70vh-60px)]">
            {selectedImage ? (
              <div ref={viewerRef} className="relative overflow-auto w-full h-full flex items-center justify-center p-4">
                <div className="relative inline-block" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: "center center", transition: "transform 0.2s" }}>
                  <img
                    src={selectedImage}
                    alt="Visualização"
                    style={{
                      maxWidth: zoom <= 1 ? "100%" : "none",
                      maxHeight: zoom <= 1 ? "100%" : "none",
                      objectFit: "contain",
                    }}
                  />
                  {/* Photo overlay - draggable & resizable */}
                  {photoOverlay && (
                    <div
                      className="absolute cursor-move border-2 border-dashed border-primary/60 hover:border-primary shadow-lg"
                      style={{
                        left: photoPosition.x,
                        top: photoPosition.y,
                        width: photoSize.w,
                        height: photoSize.h,
                      }}
                      onMouseDown={onPhotoMouseDown}
                    >
                      <img
                        src={photoOverlay}
                        alt="Foto"
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      {/* Resize handle */}
                      <div
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full cursor-se-resize"
                        onMouseDown={onResizeMouseDown}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-white/20 text-sm flex flex-col items-center gap-2">
                <ZoomIn className="size-10" />
                <span>Clique em uma imagem para visualizar</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
