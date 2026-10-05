import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function DiditVerificationDialog({ url, frame, close }: {
  url: string | null; frame: RefObject<HTMLIFrameElement | null>; close: () => void;
}) {
  return <Dialog open={Boolean(url)} onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] max-w-xl flex-col gap-3 overflow-hidden p-4 sm:p-6"
      onPointerDownOutside={(event) => event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Verify with Didit</DialogTitle>
        <DialogDescription>Exiting before you finish resets your registration.</DialogDescription>
      </DialogHeader>
      {url && <iframe ref={frame} src={url} title="Didit identity verification"
        allow="camera; microphone; fullscreen; autoplay; encrypted-media; geolocation"
        className="min-h-0 w-full flex-1 rounded-lg border bg-white" />}
      <Button variant="outline" className="w-full shrink-0" onClick={close}>Exit verification</Button>
    </DialogContent>
  </Dialog>;
}
