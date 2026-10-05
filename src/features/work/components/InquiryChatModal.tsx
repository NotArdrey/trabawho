import { useEffect, useRef, useState } from "react";
import { Banknote, MessageSquareText, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";
import type { WorkInquiry } from "@/features/work/types/inquiry";
import { BookingQuoteCard } from "@/features/bookings/components/BookingQuoteCard";
import { ProviderQuoteComposer, type QuoteProposalInput } from "@/features/bookings/components/ProviderQuoteComposer";
import { proposeBookingQuote } from "@/features/bookings/services/bookingTransactions";
import type { BookingQuote } from "@/features/bookings/types/booking-transactions";
import { fetchBookingById } from "@/features/bookings/services/bookingService";
import {
  fetchBookingMessages,
  sendBookingMessage,
} from "@/features/bookings";

type ComposerMode = "message" | "quote";

interface QuoteContent {
  amount: number;
  description: string;
}

interface InquiryMessage {
  content: string | QuoteContent;
  id: string;
  sender: string;
  timestamp?: string;
  type?: string;
}

export interface InquiryChatModalProps {
  inquiry: WorkInquiry;
  onBookingUpdated?: (booking: unknown) => void;
  onClose: () => void;
  onError?: (message: string) => void;
}

interface InquiryBookingSnapshot {
  activeQuote?: BookingQuote | null;
  id: string;
  paymentStatus?: string;
  scheduleStatus?: string;
  status?: string;
}

const QUICK_REPLY = "Hi! I'm available to help. Could you confirm the preferred date and any important details?";
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const sendMessage = sendBookingMessage as unknown as (
  booking: Record<string, unknown>,
  body: string,
  metadata?: unknown,
) => Promise<InquiryMessage>;

function InquiryChatModal({ inquiry, onClose, onBookingUpdated, onError }: InquiryChatModalProps) {
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("message");
  const [bookingSnapshot, setBookingSnapshot] = useState<InquiryBookingSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const loadMessages = async () => {
      const bookingId = typeof inquiry.booking?.id === "string" ? inquiry.booking.id : null;
      if (!inquiry.booking || !bookingId) {
        setMessages([]);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const [rows, booking] = await Promise.all([
          fetchBookingMessages(inquiry.booking) as Promise<InquiryMessage[]>,
          fetchBookingById(bookingId) as Promise<InquiryBookingSnapshot>,
        ]);
        if (mounted) { setMessages(rows); setBookingSnapshot(booking); }
      } catch (error) {
        if (mounted) onError?.(errorMessage(error, "Unable to load inquiry messages."));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void loadMessages();
    return () => { mounted = false; };
  }, [inquiry.booking, onError]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    if (typeof list.scrollTo === "function") {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    } else {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const sendReply = async () => {
    if (!replyText.trim() || !inquiry.booking || savingRef.current) return;
    savingRef.current = true;
    try {
      setIsSaving(true);
      const saved = await sendMessage(inquiry.booking, replyText.trim());
      setMessages((current) => [...current, saved]);
      setReplyText("");
    } catch (error) {
      onError?.(errorMessage(error, "Unable to send reply."));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const sendQuote = async (input: QuoteProposalInput) => {
    const bookingId = typeof inquiry.booking?.id === "string" ? inquiry.booking.id : null;
    if (!bookingId) throw new Error("This request is no longer available.");
    await proposeBookingQuote({ bookingId, ...input });
    const updatedBooking = await fetchBookingById(bookingId) as InquiryBookingSnapshot;
    setBookingSnapshot(updatedBooking);
    setComposerMode("message");
    onBookingUpdated?.(updatedBooking);
  };

  const openQuote = () => {
    setComposerMode("quote");
  };

  const canQuote = Boolean(inquiry.booking?.id && bookingSnapshot
    && !["Completed Service", "Cancelled", "Cancelled (Cash)", "Service Stopped", "Refund Processing", "Refunded"].includes(bookingSnapshot.status || "")
    && !["held", "confirmed", "reschedule_requested"].includes(bookingSnapshot.scheduleStatus || "")
    && !["partially_paid", "paid", "refund_pending", "refunded"].includes(bookingSnapshot.paymentStatus || ""));
  const proposedAmount = inquiry.proposedBudget?.match(/[\d,.]+/)?.[0]?.replaceAll(",", "") || "";

  const showConversation = composerMode === "message" || messages.length > 0 || isLoading;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "grid w-[calc(100vw-1rem)] max-w-[36rem]! gap-0 overflow-hidden rounded-2xl p-0 shadow-xl sm:w-[calc(100vw-2rem)]",
          "max-h-[calc(100svh-2rem)] grid-rows-[auto_auto_minmax(13.75rem,auto)_auto]",
          "max-sm:max-h-[calc(100svh-1rem)] max-sm:rounded-xl",
          composerMode === "quote" && "grid-rows-[auto_auto_minmax(0,1fr)]",
        )}
        data-testid="inquiry-response-dialog"
      >
        <DialogHeader className="border-b px-5 py-4 pr-16 max-sm:px-4 max-sm:pr-14">
          <div className="flex min-w-0 items-center gap-3">
            <img className="size-11 shrink-0 rounded-full bg-muted object-cover" src={getProfilePhotoUrl(inquiry.clientPhoto)} alt="" />
            <div className="min-w-0">
              <DialogTitle className="text-lg">{inquiry.clientName}</DialogTitle>
              <DialogDescription className="truncate">{inquiry.service}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-start gap-2.5 bg-muted/60 px-5 py-3 text-sm text-muted-foreground max-sm:px-4">
          <MessageSquareText className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <strong className="block text-[13px] text-foreground">Service request</strong>
            <p className="mt-0.5 leading-5">{inquiry.description}</p>
          </div>
        </div>

        {showConversation ? (
          <div
            ref={messageListRef}
            className="min-h-[13.75rem] max-h-[46svh] overflow-y-auto overscroll-contain bg-muted/30 p-5 max-sm:min-h-[11.875rem] max-sm:max-h-[40svh] max-sm:px-4"
            aria-live="polite"
            aria-label="Conversation messages"
          >
            {isLoading ? <EmptyConversation loading /> : messages.length ? messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            )) : <EmptyConversation />}
            {bookingSnapshot?.activeQuote ? <BookingQuoteCard quote={bookingSnapshot.activeQuote} canRespond={false} /> : null}
          </div>
        ) : null}

        <div className={cn("border-t bg-background px-3 pb-3 pt-2.5", composerMode === "quote" && "min-h-0 overflow-y-auto overscroll-contain")}>
          {composerMode === "message" ? (
            <MessageComposer
              clientName={inquiry.clientName}
              isSaving={isSaving}
              replyText={replyText}
              onChange={setReplyText}
              onOpenQuote={openQuote}
              canQuote={canQuote}
              onSend={() => void sendReply()}
            />
          ) : (
            <ProviderQuoteComposer initialAmount={proposedAmount} onCancel={() => setComposerMode("message")} onSubmit={sendQuote} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyConversation({ loading = false }: { loading?: boolean }) {
  return <div className="flex min-h-[11.25rem] flex-col items-center justify-center gap-1.5 px-6 py-5 text-center text-muted-foreground">
    {!loading ? <MessageSquareText className="mb-1 size-9 text-primary" aria-hidden="true" /> : null}
    <strong className="text-foreground">{loading ? "Loading conversation..." : "Start the conversation"}</strong>
    {!loading ? <p className="m-0 max-w-sm text-[13px] leading-5">Reply to clarify the request, confirm availability, or send a price quote.</p> : null}
  </div>;
}

function MessageBubble({ message }: { message: InquiryMessage }) {
  const worker = message.sender === "worker";
  const quote = message.type === "quote" && typeof message.content !== "string" ? message.content : null;
  return <div className={cn("mb-3.5 w-fit max-w-[82%]", worker && "ml-auto")}>
    {quote ? <div className="grid gap-1 rounded-[14px_14px_4px_14px] bg-emerald-50 px-3.5 py-3 text-foreground dark:bg-emerald-950/40">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Price quote</span>
      <strong className="text-xl">PHP {quote.amount}</strong>
      <p className="m-0 text-[13px]">{quote.description}</p>
    </div> : <p className={cn(
      "m-0 rounded-[14px_14px_14px_4px] bg-background px-3.5 py-2.5 text-sm leading-5 text-foreground",
      worker && "rounded-[14px_14px_4px_14px] bg-primary text-primary-foreground",
    )}>{typeof message.content === "string" ? message.content : message.content.description}</p>}
    {message.timestamp ? <span className={cn("mt-1 block px-1 text-[11px] text-muted-foreground", worker && "text-right")}>{message.timestamp}</span> : null}
  </div>;
}

interface MessageComposerProps {
  canQuote: boolean;
  clientName: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onOpenQuote: () => void;
  onSend: () => void;
  replyText: string;
}

function MessageComposer({ canQuote, clientName, isSaving, onChange, onOpenQuote, onSend, replyText }: MessageComposerProps) {
  return <>
    <div className="mb-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Response options">
      <Button type="button" variant="ghost" size="sm" className="min-h-9 text-muted-foreground" onClick={() => onChange(QUICK_REPLY)}><Sparkles aria-hidden="true" />Use quick reply</Button>
      {canQuote ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-muted-foreground" onClick={onOpenQuote}><Banknote aria-hidden="true" />Create quote</Button> : null}
    </div>
    <div className="flex items-end gap-2">
      <Label htmlFor="inquiry-reply" className="sr-only">Reply to {clientName}</Label>
      <Textarea id="inquiry-reply" className="min-h-12 max-h-32 flex-1 resize-y" placeholder="Write a reply..." value={replyText} rows={2} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (!event.repeat && !event.nativeEvent.isComposing && !isSaving) onSend();
        }
      }} />
      <Button type="button" size="icon" className="size-12" aria-label="Send reply" onClick={onSend} disabled={!replyText.trim()} isLoading={isSaving}><Send aria-hidden="true" /></Button>
    </div>
    <p className="mx-0.5 mb-0 mt-1.5 text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p>
  </>;
}

export default InquiryChatModal;
