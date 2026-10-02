import { insertBookingMessage } from "./messagePersistence";

const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

describe("message persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ insert: mocks.insert }); mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
  });

  it("uses body and attachments for text and quote messages", async () => {
    const attachments = { type: "quote", amount: 850, description: "Repair appliances" };
    mocks.single.mockResolvedValue({ data: { id: "message-1", body: "Hello", attachments }, error: null });
    await insertBookingMessage({ conversationId: "conversation-1", senderId: "worker-1", body: " Hello ", attachments });
    expect(mocks.from).toHaveBeenCalledWith("messages");
    expect(mocks.insert).toHaveBeenCalledWith({ conversation_id: "conversation-1", sender_id: "worker-1", body: "Hello", attachments });
  });

  it("does not retry failed writes with nonexistent legacy columns or expose server diagnostics", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "42703", message: "private database diagnostic" } });
    await expect(insertBookingMessage({ conversationId: "conversation-1", senderId: "worker-1", body: "Hello" })).rejects.toThrow("temporarily unavailable");
    expect(mocks.insert).toHaveBeenCalledOnce();
  });

  it("rejects empty input before querying", async () => {
    await expect(insertBookingMessage({ conversationId: "conversation-1", senderId: "worker-1", body: " " })).rejects.toThrow("Enter a message");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
