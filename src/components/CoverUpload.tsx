import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CoverUpload({
  value,
  onChange,
  bucket = "podcast-covers",
  className = "",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const pick = () => ref.current?.click();

  const upload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx 5MB).");
    setLoading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    setLoading(false);
  };

  const remove = async () => {
    if (value) {
      // Best-effort delete from storage if URL is from our bucket
      try {
        const marker = `/${bucket}/`;
        const idx = value.indexOf(marker);
        if (idx > -1) {
          const path = value.slice(idx + marker.length);
          await supabase.storage.from(bucket).remove([path]);
        }
      } catch { /* noop */ }
    }
    onChange(null);
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/15 to-blush/25">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={pick}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent"
        >
          <Upload className="h-3.5 w-3.5" />
          {value ? "Trocar imagem" : "Enviar imagem"}
        </button>
        {value && (
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" /> Remover
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
