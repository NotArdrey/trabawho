import { useEffect, useRef, useState } from "react";
import { fetchBookingMessages, sendBookingMessage } from "@/features/bookings/services/bookingService";
import { actionErrorMessage } from "@/shared/utils/actionError";

interface ChatBooking extends Record<string, unknown> { id?: string }
export interface ConversationMessage {
  id: string;
  sender: string;
  type: string;
  content: string | { amount: number; description: string; deliveryTime?: string; note?: string };
  timestamp?: string;
}

const mergeMessages = (current: ConversationMessage[], incoming: ConversationMessage[]) => {
  const messages = new Map(incoming.map((message) => [message.id, message]));
  current.forEach((message) => messages.set(message.id, message));
  return [...messages.values()];
};

export function useBookingConversation(booking: ChatBooking) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const bookingRef = useRef(booking);
  useEffect(() => { bookingRef.current = booking; }, [booking]);
  const sendingRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    let disposed = false;
    let loading = false;
    void Promise.resolve().then(() => {
      if (disposed) return;
      setMessages([]);
      setMessageError("");
      setRefreshError("");
      setIsLoading(Boolean(booking.id));
    });

    const refresh = async () => {
      if (!booking.id || disposed || loading) return;
      loading = true;
      try {
        const rows = await fetchBookingMessages(bookingRef.current) as ConversationMessage[];
        if (!disposed) {
          setMessages((current) => mergeMessages(current, rows));
          setRefreshError("");
        }
      } catch {
        if (!disposed) setRefreshError("Unable to refresh messages. Check your connection; we'll retry automatically.");
      } finally {
        loading = false;
        if (!disposed) setIsLoading(false);
      }
    };
    void refresh();
    // Polling also works on projects where messages are not in the realtime publication.
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      generationRef.current = generation + 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [booking.id]);

  const send = async (body: string): Promise<boolean> => {
    if (!body.trim() || sendingRef.current) return false;
    sendingRef.current = true;
    setIsSending(true);
    setMessageError("");
    const generation = generationRef.current;
    try {
      const saved = await sendBookingMessage(bookingRef.current, body.trim()) as ConversationMessage;
      if (generation !== generationRef.current) return false;
      setMessages((current) => mergeMessages(current, [saved]));
      return true;
    } catch (error) {
      if (generation === generationRef.current) setMessageError(actionErrorMessage(error, "Unable to send your message. Your draft is saved here; try again."));
      return false;
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  return { messages, setMessages, isLoading, isSending, messageError: messageError || refreshError, send };
}
