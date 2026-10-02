import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/database.types";
import { ActionError, databaseActionError } from "@/shared/utils/actionError";

export async function insertBookingMessage({ conversationId, senderId, body, attachments = null }: {
  conversationId: string; senderId: string; body: string | null; attachments?: Json;
}) {
  const cleanBody = body?.trim() || null;
  if (!cleanBody && !attachments) throw new ActionError("Enter a message before sending.");
  const { data, error } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: senderId, body: cleanBody, attachments,
  }).select("*").single();
  if (error) throw databaseActionError(error, "Unable to send your message. Your draft is still here; try again.");
  if (!data) throw new ActionError("Your message could not be confirmed. Refresh the conversation before retrying.");
  return data;
}
