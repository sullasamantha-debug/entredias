import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export function TagInput({
  value, onChange, placeholder = "Adicionar tag e Enter",
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setInput("");
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !input && value.length) remove(value[value.length - 1]);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[40px]">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs">
          {t}
          <button type="button" onClick={() => remove(t)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input
        value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} onBlur={add}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
      />
    </div>
  );
}

export function TagBadges({ tags }: { tags?: string[] | null }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-accent/70 px-2 py-0.5 text-[10px] text-foreground/80">{t}</span>
      ))}
    </div>
  );
}
