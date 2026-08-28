import { supabase } from './supabaseClient';

const CHATBOT_FUNCTION_NAME = 'trabawho-chatbot';
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const normalizeAttachment = (attachment) => {
  if (!attachment || attachment.type !== 'image') return null;

  const dataUrl = String(attachment.dataUrl || '').trim();
  const mediaType = String(attachment.mediaType || '').trim().toLowerCase();
  if (!dataUrl || !SUPPORTED_IMAGE_TYPES.has(mediaType)) return null;

  return {
    type: 'image',
    name: String(attachment.name || 'problem-photo').trim().slice(0, 120),
    mediaType,
    dataUrl,
  };
};

const normalizeMessage = (message) => {
  const attachments = (Array.isArray(message?.attachments) ? message.attachments : [])
    .map(normalizeAttachment)
    .filter(Boolean)
    .slice(0, 1);

  return {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: String(message.content || '').trim().slice(0, 1200),
    ...(attachments.length > 0 ? { attachments } : {}),
  };
};

export const sendChatbotMessage = async ({ messages, context, attachments = [] }) => {
  const cleanMessages = (Array.isArray(messages) ? messages : [])
    .map(normalizeMessage)
    .filter((message) => message.content.length > 0)
    .slice(-10);
  const cleanAttachments = (Array.isArray(attachments) ? attachments : [])
    .map(normalizeAttachment)
    .filter(Boolean)
    .slice(0, 1);

  if (cleanMessages.length === 0) {
    throw new Error('Type a message before sending.');
  }

  const { data, error } = await supabase.functions.invoke(CHATBOT_FUNCTION_NAME, {
    body: {
      messages: cleanMessages,
      context: {
        currentView: context?.currentView || 'landing',
        isLoggedIn: Boolean(context?.isLoggedIn),
        role: context?.role || 'guest',
      },
      attachments: cleanAttachments,
    },
  });

  if (error) {
    console.error('trabawho-chatbot failed', {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error('The assistant is unavailable right now. Please try again in a moment.');
  }

  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  if (!message) {
    throw new Error('The assistant returned an empty response. Please try again.');
  }

  return {
    message,
    model: data?.model || '',
    matches: Array.isArray(data?.matches) ? data.matches : [],
    estimate: data?.estimate || null,
    diagnosis: data?.diagnosis || null,
    sources: Array.isArray(data?.sources) ? data.sources : [],
  };
};
