import { useEffect, useState } from "react";
import { fetchBookingById, fetchConversationById } from "@/features/bookings/services/bookingService";

type Scope = "incoming" | "purchases";
interface Options {
  isWorker: boolean;
  isChat: boolean;
  isProviderRoute: boolean;
  requestedScope: string | null;
  selectedId: string | null;
  userId: string;
}
interface ParticipantRecord { sellerId?: string; workerId?: string }
const loadBooking = fetchBookingById as (id: string) => Promise<ParticipantRecord | null>;
const loadConversation = fetchConversationById as (id: string) => Promise<ParticipantRecord | null>;

export function useChatScope({ isWorker, isChat, isProviderRoute, requestedScope, selectedId, userId }: Options) {
  const explicitScope = requestedScope === "incoming" || requestedScope === "purchases" ? requestedScope : null;
  const defaultScope: Scope = isWorker && (isProviderRoute || isChat) ? "incoming" : "purchases";
  const key = `${userId}:${selectedId || ""}`;
  const [resolved, setResolved] = useState<{ key: string; scope: Scope } | null>(null);
  const resolving = Boolean(isWorker && isChat && selectedId && !explicitScope && resolved?.key !== key);
  useEffect(() => {
    if (!resolving || !selectedId) return;
    let active = true;
    void (async () => {
      try {
        const record = selectedId.startsWith("conversation:")
          ? await loadConversation(selectedId.slice("conversation:".length))
          : await loadBooking(selectedId) || await loadConversation(selectedId);
        if (active) setResolved({ key, scope: record ? (String(record.sellerId || record.workerId || "") === userId ? "incoming" : "purchases") : defaultScope });
      } catch {
        if (active) setResolved({ key, scope: defaultScope });
      }
    })();
    return () => { active = false; };
  }, [defaultScope, key, resolving, selectedId, userId]);
  const activeScope = isWorker && isChat ? explicitScope || (resolved?.key === key ? resolved.scope : defaultScope) : defaultScope;
  return { activeScope, isResolvingChatScope: resolving };
}
