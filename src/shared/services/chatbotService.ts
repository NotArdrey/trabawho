import { supabase } from "@/integrations/supabase";

interface ChatAttachment {
  type: string;
  name?: string;
  mediaType: string;
  dataUrl: string;
}
interface ChatMessage {
  role: string;
  content: string;
  attachments?: ChatAttachment[];
}
interface ChatRequest {
  messages: ChatMessage[];
  context?: { currentView?: string; isLoggedIn?: boolean; role?: string };
  attachments?: ChatAttachment[];
}
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const normalizeAttachment = (attachment: ChatAttachment) => {
  const mediaType = attachment.mediaType.trim().toLowerCase();
  const dataUrl = attachment.dataUrl.trim();
  if (attachment.type !== "image" || !supportedTypes.has(mediaType) || !dataUrl.startsWith(`data:${mediaType};base64,`)) return null;
  return { type: "image", name: (attachment.name || "problem-photo").trim().slice(0, 120), mediaType, dataUrl };
};
const normalizeAttachments = (attachments: ChatAttachment[] = []) => attachments.map(normalizeAttachment).filter((attachment) => attachment !== null).slice(0, 1);
const objectValue = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

export async function sendChatbotMessage({ messages, context, attachments = [] }: ChatRequest) {
  const latestUserIndex = messages.reduce((latest, message, index) => message.role !== "assistant" ? index : latest, -1);
  const cleanMessages = messages.map((message, index) => {
    // Past images stay visible in the conversation, but must not trigger a new photo analysis.
    const images = index === latestUserIndex ? normalizeAttachments(message.attachments) : [];
    return { role: message.role === "assistant" ? "assistant" : "user", content: message.content.trim().slice(0, 1200), ...(images.length ? { attachments: images } : {}) };
  }).filter((message) => message.content.length > 0).slice(-10);
  const cleanAttachments = normalizeAttachments(attachments);
  if (!cleanMessages.length) throw new Error("Type a message before sending.");

  const result = await supabase.functions.invoke<unknown>("trabawho-chatbot", {
    body: { messages: cleanMessages, context: { currentView: context?.currentView || "landing", isLoggedIn: Boolean(context?.isLoggedIn), role: context?.role || "guest" }, attachments: cleanAttachments },
  });
  const rawData: unknown = result.data;
  const error: unknown = result.error;
  if (error) {
    // Read only status, never relay the provider's raw error body or credentials.
    const errorObject = objectValue(error);
    const response = errorObject.context;
    const status = response instanceof Response ? response.status : undefined;
    if (cleanAttachments.length || cleanMessages.at(-1)?.attachments?.length) {
      if (status === 413) throw new Error("That photo is too large. Try a smaller JPG, PNG, or WebP image.");
      throw new Error("The assistant could not analyze that photo right now. Try again or describe the image in a message.");
    }
    throw new Error("The assistant is unavailable right now. Please try again in a moment.");
  }
  const data = objectValue(rawData);
  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (!message) throw new Error("The assistant returned an empty response. Please try again.");
  return { message, model: typeof data.model === "string" ? data.model : "", matches: Array.isArray(data.matches) ? data.matches as unknown[] : [], estimate: data.estimate || null, diagnosis: data.diagnosis || null, sources: Array.isArray(data.sources) ? data.sources as unknown[] : [] };
}
