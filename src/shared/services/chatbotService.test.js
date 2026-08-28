import { sendChatbotMessage } from './chatbotService';
import { supabase } from './supabaseClient';

jest.mock('./supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('sendChatbotMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps uploaded image attachments in the function payload and latest message', async () => {
    const attachment = {
      type: 'image',
      name: 'problem.jpg',
      mediaType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,abc123',
    };

    supabase.functions.invoke.mockResolvedValue({
      data: { message: 'Photo analyzed.' },
      error: null,
    });

    await sendChatbotMessage({
      messages: [
        {
          role: 'user',
          content: 'Please identify this problem.',
          attachments: [attachment],
        },
      ],
      context: { currentView: 'client-dashboard', isLoggedIn: true, role: 'client' },
      attachments: [attachment],
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('trabawho-chatbot', {
      body: expect.objectContaining({
        attachments: [attachment],
        messages: [
          expect.objectContaining({
            role: 'user',
            content: 'Please identify this problem.',
            attachments: [attachment],
          }),
        ],
      }),
    });
  });
});
