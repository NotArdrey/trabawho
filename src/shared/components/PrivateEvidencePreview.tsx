import { useEffect, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PrivateEvidencePreviewProps {
  path: string | null;
  title: string;
  description?: string;
  loadUrl: (path: string) => Promise<string>;
  onClose: () => void;
}

function EvidenceImage({ path, title, loadUrl, onRetry }: { path: string; title: string; loadUrl: (path: string) => Promise<string>; onRetry: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadUrl(path).then((value) => { if (active) setUrl(value); })
      .catch(() => { if (active) setError("This private image is unavailable or access has expired. Check your access and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, loadUrl]);

  useEffect(() => {
    if (!url) return;
    const timer = window.setTimeout(() => {
      setUrl("");
      setError("The private image link expired. Refresh the preview to continue.");
    }, 290_000);
    return () => window.clearTimeout(timer);
  }, [url]);

  return <div className="flex min-h-40 min-w-0 flex-1 items-center justify-center overflow-auto rounded-lg border bg-muted/30 p-2" aria-live="polite">
        {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" aria-hidden="true" />Loading private image…</p>}
        {!loading && error && <div role="alert" className="grid justify-items-center gap-3 p-4 text-center text-sm"><ImageOff className="size-8 text-muted-foreground" aria-hidden="true" /><p>{error}</p><Button type="button" variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" />Retry preview</Button></div>}
        {!loading && url && <img className="max-h-[65dvh] max-w-full object-contain" src={url} alt={title} onError={() => { setUrl(""); setError("The image could not be displayed. Refresh the preview to request a new link."); }} />}
      </div>
}

export function PrivateEvidencePreview({ path, title, description, loadUrl, onClose }: PrivateEvidencePreviewProps) {
  const [revision, setRevision] = useState(0);
  return <Dialog open={Boolean(path)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[min(90dvh,900px)] max-w-4xl flex-col overflow-hidden p-4 sm:p-6">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description || "Private case evidence. Only authorized case participants and support can view it."}</DialogDescription></DialogHeader>
      {path && <EvidenceImage key={`${path}:${revision}`} path={path} title={title} loadUrl={loadUrl} onRetry={() => setRevision((value) => value + 1)} />}
    </DialogContent>
  </Dialog>;
}
