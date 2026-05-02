import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X } from "lucide-react";

interface SiteImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  pathPrefix?: string;
}

export default function SiteImageUpload({ 
  label, 
  value, 
  onChange, 
  bucket = "product-images",
  pathPrefix = "site" 
}: SiteImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao enviar imagem: " + (error.message || "Tente novamente"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400 font-medium block">{label}</label>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-black/30 border-white/10 text-white flex-1"
            placeholder="URL da imagem..."
          />
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-white/10 bg-white/5 hover:bg-white/10 shrink-0"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </Button>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange("")}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {value && (
          <div className="mt-2 rounded-lg overflow-hidden border border-white/10 max-w-[200px] h-24 bg-black/20">
            <img 
              src={value} 
              alt="Preview" 
              className="w-full h-full object-cover" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x100?text=Erro+na+Imagem';
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}