import { supabase } from "@/integrations/supabase";
import { sendChatbotMessage } from "./chatbotService";

vi.mock("@/integrations/supabase", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
const invoke = vi.spyOn(supabase.functions, "invoke");
const photo = { type: "image", mediaType: "image/png", name: "logo.png", dataUrl: "data:image/png;base64,YWJj" };
beforeEach(() => { vi.clearAllMocks(); });

it("does not send earlier photos again with a text-only follow-up", async () => {
  invoke.mockResolvedValue({ data: { message: "You are welcome." }, error: null });
  await sendChatbotMessage({ messages: [{ role: "user", content: "What is this?", attachments: [photo] }, { role: "assistant", content: "A logo." }, { role: "user", content: "Thanks for the help" }] });
  expect(invoke).toHaveBeenCalledWith("trabawho-chatbot", { body: { context: { currentView: "landing", isLoggedIn: false, role: "guest" }, attachments: [], messages: [{ role: "user", content: "What is this?" }, { role: "assistant", content: "A logo." }, { role: "user", content: "Thanks for the help" }] } });
});

it("offers a photo-specific recovery action without exposing provider errors", async () => {
  invoke.mockResolvedValue({ data: null, error: new Error("private provider failure") });
  await expect(sendChatbotMessage({ messages: [{ role: "user", content: "What is this?", attachments: [photo] }], attachments: [photo] })).rejects.toThrow("Try again or describe the image in a message.");
});
