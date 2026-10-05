import { useEffect, useRef, useState } from "react";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProviderQuoteComposer, type QuoteProposalInput } from "@/features/bookings/components/ProviderQuoteComposer";

interface QuoteBooking {
  id?: string;
  paymentStatus?: string | null;
  raw?: { booking?: { status?: string | null } };
  scheduleStatus?: string | null;
}

interface ProviderQuoteActionProps {
  booking?: QuoteBooking | null;
  isClosedConversation: boolean;
  isRequestBooking: boolean;
  onProposeQuote?: (input: QuoteProposalInput) => Promise<unknown>;
  viewerRole: string;
}

export function ProviderQuoteAction({ booking, isClosedConversation, isRequestBooking,
  onProposeQuote, viewerRole }: ProviderQuoteActionProps) {
  const [open, setOpen] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const canQuote = viewerRole === "seller" && isRequestBooking && !isClosedConversation
    && Boolean(onProposeQuote) && (!booking?.raw?.booking?.status || booking.raw.booking.status === "pending")
    && !["held", "confirmed", "reschedule_requested"].includes(booking?.scheduleStatus || "")
    && !["partially_paid", "paid", "refund_pending", "refunded"].includes(booking?.paymentStatus || "");

  useEffect(() => {
    if (open) editorRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    else if (wasOpen.current) actionRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!canQuote || !onProposeQuote) return null;

  return <section className="min-w-0 shrink-0 border-t bg-background" aria-label="Provider quote actions">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      <Button ref={actionRef} type="button" variant={open ? "ghost" : "outline"} className="min-h-11"
        aria-expanded={open} aria-controls="provider-quote-editor" onClick={() => setOpen((current) => !current)}>
        <CalendarPlus className="size-4" aria-hidden="true" />{open ? "Back to messages" : "Create quote"}
      </Button>
      {!open && <p className="text-xs text-muted-foreground">Send a price and proposed visit time to this client.</p>}
    </div>
    {open && <div id="provider-quote-editor" ref={editorRef} role="region"
      className="max-h-[min(55svh,36rem)] overflow-y-auto overscroll-contain pb-2" aria-label="Quote editor">
      <ProviderQuoteComposer onCancel={() => setOpen(false)} onSubmit={async (input) => {
        await onProposeQuote(input);
        setOpen(false);
      }} />
    </div>}
  </section>;
}
