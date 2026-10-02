import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface FilePickerProps {
  accept: string;
  disabled?: boolean;
  file: File | null;
  hint: string;
  label: string;
  onChange: (file: File | null) => void;
}

function FilePicker({ accept, disabled = false, file, hint, label, onChange }: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    if (input.current) input.current.value = "";
    onChange(null);
  };

  return <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
    <div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
    <input ref={input} type="file" accept={accept} className="sr-only" tabIndex={-1} disabled={disabled}
      aria-label={label} onChange={(event) => onChange(event.target.files?.[0] || null)} />
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}><ImagePlus aria-hidden="true" />{file ? "Change photo" : "Choose photo"}</Button>
      {file && <><span className="min-w-0 flex-1 break-all text-sm" role="status">{file.name}</span>
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={clear}><X aria-hidden="true" /></Button></>}
    </div>
  </div>;
}

export { FilePicker };
