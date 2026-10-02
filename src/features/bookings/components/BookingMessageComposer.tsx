import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  conversationId: string;
  hasQuote: boolean;
  isSending: boolean;
  onSend: (body: string) => Promise<boolean>;
}

export function BookingMessageComposer({ conversationId, hasQuote, isSending, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const pendingRef = useRef(false);
  const conversationRef = useRef(conversationId);
  useEffect(() => {
    conversationRef.current = conversationId;
    return () => { conversationRef.current = ""; };
  }, [conversationId]);

  const submit = async () => {
    if (pendingRef.current || isSending || !draft.trim()) return;
    pendingRef.current = true;
    const submitted = draft;
    const target = conversationId;
    try {
      if (await onSend(submitted) && conversationRef.current === target) {
        setDraft((current) => current === submitted ? "" : current);
      }
    } finally {
      pendingRef.current = false;
    }
  };

  return (
    <form className="flex items-center gap-2 border-t bg-background p-4" aria-label="Send a message"
      onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <Input aria-label="Message" className="min-h-11 min-w-0 flex-1" value={draft}
        placeholder={hasQuote ? "Ask a question or discuss the quote..." : "Ask a question or share booking details..."}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.repeat || event.nativeEvent.isComposing)) event.preventDefault();
        }} />
      <Button type="submit" className="min-h-11" disabled={!draft.trim() || isSending} isLoading={isSending}>
        <Send className="size-4" aria-hidden="true" />{isSending ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}
