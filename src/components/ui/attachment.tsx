import { Eye, FileText, LoaderCircle, Paperclip, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AttachmentProps {
  className?: string;
  description?: string;
  href?: string;
  name: string;
  onRemove?: () => void;
}

function Attachment({ className, description, href, name, onRemove }: AttachmentProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-xl bg-muted/60 p-3", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" title={name}>{name}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {href ? (
          <Button asChild type="button" variant="ghost" size="icon" aria-label={`View ${name}`}>
            <a href={href} target="_blank" rel="noreferrer"><Eye aria-hidden="true" /><span className="sr-only">View {name}</span></a>
          </Button>
        ) : null}
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={`Remove ${name}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface AttachmentUploadProps {
  acceptLabel?: string;
  isUploading?: boolean;
  onChoose: () => void;
}

function AttachmentUpload({ acceptLabel = "PDF, Word, JPG, PNG, or WEBP", isUploading = false, onChoose }: AttachmentUploadProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/45 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
          <Paperclip className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Attach supporting work</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{acceptLabel}</p>
        </div>
      </div>
      <Button type="button" variant="outline" className="w-full bg-background sm:w-auto" onClick={onChoose} disabled={isUploading}>
        {isUploading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
        {isUploading ? "Uploading…" : "Choose file"}
      </Button>
    </div>
  );
}

export { Attachment, AttachmentUpload };
export type { AttachmentProps, AttachmentUploadProps };
