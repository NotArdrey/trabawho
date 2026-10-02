import { useBookingConversation } from "../hooks/useBookingConversation";
import type { ArchivedChat } from "../services/chatArchive";

export function ArchivedChatHistory({ chat }: { chat: ArchivedChat }) {
  const { messages, isLoading, messageError } = useBookingConversation(chat);
  return <section aria-label="Archived messages" className="min-h-32 space-y-3">
    {isLoading && <p role="status" className="text-sm text-muted-foreground">Loading messages…</p>}
    {messageError && <p role="alert" className="text-sm text-destructive">{messageError}</p>}
    {!isLoading && !messageError && messages.length === 0 && <p className="text-sm text-muted-foreground">No messages in this conversation yet.</p>}
    {messages.map((message) => <article key={message.id} className="rounded-lg bg-muted p-3">
      <p className="text-xs font-semibold text-primary">{message.sender === "worker" ? chat.workerName : chat.clientName}</p>
      {typeof message.content === "string"
        ? <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        : <div className="text-sm"><p className="font-medium">Quote: PHP {message.content.amount.toLocaleString("en-PH")}</p><p className="whitespace-pre-wrap break-words">{message.content.description}</p>{message.content.deliveryTime && <p>{message.content.deliveryTime}</p>}{message.content.note && <p>{message.content.note}</p>}</div>}
      {message.timestamp && <p className="mt-1 text-xs text-muted-foreground">{message.timestamp}</p>}
    </article>)}
  </section>;
}
