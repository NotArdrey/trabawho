import { useEffect, useRef, useState } from "react";
import { Banknote, MessageSquareText, PhilippinePeso, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";
import type { WorkInquiry } from "@/features/work/types/inquiry";
import {
  fetchBookingMessages,
  sendBookingMessage,
  updateBookingWorkflow,
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
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDescription, setQuoteDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const loadMessages = async () => {
      if (!inquiry.booking) {
        setMessages([]);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const rows = await fetchBookingMessages(inquiry.booking) as InquiryMessage[];
        if (mounted) setMessages(rows);
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
    if (!replyText.trim() || !inquiry.booking || isSaving) return;
    try {
      setIsSaving(true);
      const saved = await sendMessage(inquiry.booking, replyText.trim());
      setMessages((current) => [...current, saved]);
      setReplyText("");
    } catch (error) {
      onError?.(errorMessage(error, "Unable to send reply."));
    } finally {
      setIsSaving(false);
    }
  };

  const sendQuote = async () => {
    const amount = Number(quoteAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !inquiry.booking) {
      onError?.("Enter a valid quote amount before sending.");
      return;
    }
    const description = quoteDescription.trim() || `Quote for ${inquiry.service}`;
    try {
      setIsSaving(true);
      const updatedBooking = await updateBookingWorkflow(inquiry.booking, {
        quoteAmount: amount,
        status: "Negotiating",
        dbStatus: "pending",
      });
      const saved = await sendMessage(inquiry.booking, description, {
        type: "quote",
        amount,
        description,
        note: "Seller quote saved to the booking record.",
      });
      setMessages((current) => [...current, saved]);
      setComposerMode("message");
      setQuoteAmount("");
      setQuoteDescription("");
      onBookingUpdated?.(updatedBooking);
    } catch (error) {
      onError?.(errorMessage(error, "Unable to send quote."));
    } finally {
      setIsSaving(false);
    }
  };

  const openQuote = () => {
    if (!quoteAmount) {
      const proposed = inquiry.proposedBudget?.match(/[\d,.]+/)?.[0]?.replaceAll(",", "");
      if (proposed && Number(proposed) > 0) setQuoteAmount(proposed);
    }
    setComposerMode("quote");
  };

  const showConversation = composerMode === "message" || messages.length > 0 || isLoading;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "grid w-[calc(100vw-2rem)] max-w-[40rem] gap-0 overflow-hidden rounded-2xl p-0 shadow-xl",
          "max-h-[calc(100svh-2rem)] grid-rows-[auto_auto_minmax(13.75rem,auto)_auto]",
          "max-sm:w-[calc(100vw-1rem)] max-sm:max-h-[calc(100svh-1rem)] max-sm:rounded-xl",
          composerMode === "quote" && "grid-rows-[auto_auto_auto]",
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
            className="min-h-[13.75rem] max-h-[46svh] overflow-y-auto overscroll-contain bg-muted/30 p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:min-h-[11.875rem] max-sm:max-h-[40svh] max-sm:px-4"
            aria-live="polite"
            aria-label="Conversation messages"
          >
            {isLoading ? <EmptyConversation loading /> : messages.length ? messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            )) : <EmptyConversation />}
          </div>
        ) : null}

        <div className="border-t bg-background px-3 pb-3 pt-2.5">
          {composerMode === "message" ? (
            <MessageComposer
              clientName={inquiry.clientName}
              isSaving={isSaving}
              replyText={replyText}
              onChange={setReplyText}
              onOpenQuote={openQuote}
              onSend={() => void sendReply()}
            />
          ) : (
            <QuoteComposer
              amount={quoteAmount}
              description={quoteDescription}
              inquiry={inquiry}
              isSaving={isSaving}
              onAmountChange={setQuoteAmount}
              onBack={() => setComposerMode("message")}
              onDescriptionChange={setQuoteDescription}
              onSend={() => void sendQuote()}
            />
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
  clientName: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onOpenQuote: () => void;
  onSend: () => void;
  replyText: string;
}

function MessageComposer({ clientName, isSaving, onChange, onOpenQuote, onSend, replyText }: MessageComposerProps) {
  return <>
    <div className="mb-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Response options">
      <Button type="button" variant="ghost" size="sm" className="min-h-9 text-muted-foreground" onClick={() => onChange(QUICK_REPLY)}><Sparkles aria-hidden="true" />Use quick reply</Button>
      <Button type="button" variant="ghost" size="sm" className="min-h-9 text-muted-foreground" onClick={onOpenQuote}><Banknote aria-hidden="true" />Create quote</Button>
    </div>
    <div className="flex items-end gap-2">
      <Label htmlFor="inquiry-reply" className="sr-only">Reply to {clientName}</Label>
      <textarea id="inquiry-reply" className="min-h-12 max-h-32 flex-1 resize-y rounded-lg border bg-background p-3 text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Write a reply..." value={replyText} rows={2} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); }
      }} />
      <Button type="button" size="icon" className="size-12" aria-label="Send reply" onClick={onSend} disabled={!replyText.trim()} isLoading={isSaving}><Send aria-hidden="true" /></Button>
    </div>
    <p className="mx-0.5 mb-0 mt-1.5 text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p>
  </>;
}

interface QuoteComposerProps {
  amount: string;
  description: string;
  inquiry: WorkInquiry;
  isSaving: boolean;
  onAmountChange: (value: string) => void;
  onBack: () => void;
  onDescriptionChange: (value: string) => void;
  onSend: () => void;
}

function QuoteComposer({ amount, description, inquiry, isSaving, onAmountChange, onBack, onDescriptionChange, onSend }: QuoteComposerProps) {
  return <div className="grid gap-4 p-2">
    <div><strong>Create a price quote</strong><p className="mt-0.5 text-xs text-muted-foreground">Review the amount and describe exactly what the client will receive.</p></div>
    <div className="grid items-start gap-4 sm:grid-cols-[minmax(10rem,0.65fr)_minmax(16rem,1.35fr)]">
      <div className="space-y-2"><Label htmlFor="quote-amount">Amount (PHP)</Label><div className="relative"><PhilippinePeso className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="quote-amount" className="pl-9 text-base tabular-nums" type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => {
        const next = event.target.value.replace(/[^\d.]/g, "");
        if ((next.match(/\./g) ?? []).length <= 1) onAmountChange(next);
      }} /></div>{inquiry.proposedBudget ? <p className="mt-1.5 text-[11px] text-muted-foreground">Client budget: {inquiry.proposedBudget}</p> : null}</div>
      <div className="space-y-2"><Label htmlFor="quote-description">Scope and inclusions <span className="font-normal text-muted-foreground">(optional)</span></Label><textarea id="quote-description" className="min-h-[5.75rem] w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Describe labor, materials, and important limitations." value={description} rows={3} onChange={(event) => onDescriptionChange(event.target.value)} /></div>
    </div>
    <div className="flex justify-end gap-2 border-t pt-3.5 max-sm:[&>button]:flex-1"><Button type="button" variant="outline" onClick={onBack}>Back to reply</Button><Button type="button" onClick={onSend} disabled={!amount || Number(amount) <= 0} isLoading={isSaving}><Send aria-hidden="true" />Send quote</Button></div>
  </div>;
}

export default InquiryChatModal;
