import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FloatingChatbot from './FloatingChatbot';
import { sendChatbotMessage } from '../services/chatbotService';
import { startServiceConversationByServiceId } from '../../features/bookings/services/bookingService';

jest.mock('../services/chatbotService', () => ({
  sendChatbotMessage: jest.fn(),
}));

jest.mock('../../features/bookings/services/bookingService', () => ({
  startServiceConversationByServiceId: jest.fn(),
}));

describe('FloatingChatbot worker matches', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
    jest.clearAllMocks();
  });

  it('starts a conversation and redirects to the selected worker chat', async () => {
    const onOpenChatPage = jest.fn();
    const workerMatch = {
      id: 'service-123',
      providerName: 'Alex Reyes',
      serviceType: 'Pipe repair',
      title: 'Leak repair',
      location: 'Cebu City',
      priceLabel: 'Quote required',
    };

    sendChatbotMessage.mockResolvedValue({
      message: 'I found a qualified worker for that problem.',
      matches: [workerMatch],
      diagnosis: { problemTitle: 'Leaking pipe' },
      estimate: {
        problemTitle: 'Leaking pipe',
        problemSummary: 'A visible leak may need pipe replacement and sealant.',
        materialSubtotalLow: 120,
        materialSubtotalHigh: 260,
        totalLow: 800,
        totalHigh: 1500,
        materials: [
          {
            name: 'PVC pipe',
            quantity: '1 piece',
            low: 80,
            high: 160,
          },
        ],
      },
      sources: [],
    });
    startServiceConversationByServiceId.mockResolvedValue({ id: 'conversation-456' });

    render(
      <FloatingChatbot
        currentView="client-dashboard"
        isLoggedIn
        onOpenChatPage={onOpenChatPage}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /open giglink assistant/i }));
    await userEvent.type(screen.getByLabelText(/message giglink assistant/i), 'Need help with a leak');
    await userEvent.click(screen.getByRole('button', { name: /^send message$/i }));

    await expect(screen.findByText('Alex Reyes')).resolves.toBeInTheDocument();
    expect(screen.getByText('PVC pipe')).toBeInTheDocument();
    expect(screen.getByText('PHP 80 - PHP 160')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /chat with worker/i }));

    await waitFor(() => {
      expect(startServiceConversationByServiceId).toHaveBeenCalledWith({
        serviceId: 'service-123',
        assistantContext: expect.objectContaining({
          source: 'giglink-chatbot',
          selected_match: workerMatch,
        }),
      });
      expect(onOpenChatPage).toHaveBeenCalledWith('conversation-456');
    });
  });

  it('resets the chat conversation and draft text', async () => {
    sendChatbotMessage.mockResolvedValue({
      message: 'You can compare workers from Browse.',
      matches: [],
      sources: [],
    });

    render(<FloatingChatbot currentView="client-dashboard" isLoggedIn />);

    await userEvent.click(screen.getByRole('button', { name: /open giglink assistant/i }));
    await userEvent.type(screen.getByLabelText(/message giglink assistant/i), 'Find a worker');
    await userEvent.click(screen.getByRole('button', { name: /^send message$/i }));

    await expect(screen.findByText('You can compare workers from Browse.')).resolves.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/message giglink assistant/i), 'draft');
    await userEvent.click(screen.getByRole('button', { name: /reset giglink assistant chat/i }));

    expect(screen.queryByText('Find a worker')).not.toBeInTheDocument();
    expect(screen.queryByText('You can compare workers from Browse.')).not.toBeInTheDocument();
    expect(screen.getByText(/Hi! I can help you browse services/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message giglink assistant/i)).toHaveValue('');
  });
});
