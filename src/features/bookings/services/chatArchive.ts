import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import { hydrateBookingRows, hydrateConversationRows } from "./bookingService";
import { isArchivedForUser, removeArchiveForUser } from "../utils/chatArchive";

type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type ChatViewerRole = "buyer" | "seller";
export interface ArchivedChat extends Record<string, unknown> {
  id: string;
  conversationId: string;
  workerName: string;
  clientName: string;
  serviceType: string;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in again to access archived chats.");
  return data.user.id;
}

export async function fetchArchivedChats(role: ChatViewerRole): Promise<ArchivedChat[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("conversations").select("*")
    .eq(role === "seller" ? "seller_id" : "buyer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load archived chats. Please try again.");
  const rows = (data ?? []).filter((row) => isArchivedForUser(row.metadata, userId));
  // Both booking-linked and chat-only threads use their conversation ID for history.
  const chats: ArchivedChat[] = await hydrateConversationRows(rows);
  const bookingIds = rows.flatMap((row) => row.booking_id ? [row.booking_id] : []);
  if (!bookingIds.length) return chats;
  const bookings = await supabase.from("bookings").select("*").in("id", bookingIds)
    .eq(role === "seller" ? "seller_id" : "buyer_id", userId);
  if (bookings.error) throw new Error("Unable to load archived chats. Please try again.");
  const presentations: { id: string; workerName: string; clientName: string; serviceType: string }[] = await hydrateBookingRows(bookings.data ?? []);
  return chats.map((chat) => {
    const bookingId = rows.find((row) => row.id === chat.conversationId)?.booking_id;
    const presentation = presentations.find((booking) => booking.id === bookingId);
    return presentation ? { ...chat, workerName: presentation.workerName, clientName: presentation.clientName, serviceType: presentation.serviceType } : chat;
  });
}

export async function unarchiveChat(conversationId: string): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("conversations").select("*")
    .eq("id", conversationId).or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).single();
  if (error || !data) throw new Error("This conversation is unavailable. Please refresh and try again.");
  const row: ConversationRow = data;
  if (!isArchivedForUser(row.metadata, userId)) throw new Error("This chat is no longer in your archive. Please refresh the list.");
  const result = await supabase.from("conversations")
    .update({ metadata: removeArchiveForUser(row.metadata, userId) })
    .eq("id", conversationId).or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).select("id").single();
  if (result.error || !result.data) throw new Error("Unable to unarchive this chat. Please try again.");
}
