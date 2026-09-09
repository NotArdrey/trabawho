import { Info, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface QrPreviewModalProps {
  imageAlt: string;
  imageSrc: string;
  isOpen: boolean;
  note: string;
  onClose: () => void;
  primaryLabel: string;
  primaryValue: string;
  subtitle: string;
  title: string;
}

export default function QrPreviewModal({ imageAlt, imageSrc, isOpen, note, onClose, primaryLabel, primaryValue, subtitle, title }: QrPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b bg-primary/5 px-5 py-5 pr-16 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <QrCode className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold sm:text-2xl">{title}</DialogTitle>
            <DialogDescription className="mt-1 leading-5">{subtitle}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid items-center gap-5 p-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:p-6">
          <div className="mx-auto w-full max-w-52 rounded-xl bg-white p-3 ring-1 ring-border">
            <img className="aspect-square w-full object-contain" src={imageSrc} alt={imageAlt} />
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{primaryLabel}</p>
            <p className="mt-1 break-words text-lg font-bold leading-6 text-foreground">{primaryValue}</p>
            <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-muted/50 p-3 text-left">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-5 text-muted-foreground">{note}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 sm:px-6">
          <DialogClose asChild><Button type="button">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
