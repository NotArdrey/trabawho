import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCaseConversation, markCaseRead, openCaseImage, sendCaseMessage } from "@/features/bookings/services/caseWorkflow";
import { CaseConversation } from "./CaseConversation";

vi.mock("@/features/bookings/services/caseWorkflow", () => ({
  getCaseConversation: vi.fn(), markCaseRead: vi.fn(), sendCaseMessage: vi.fn(), openCaseImage: vi.fn(),
}));

describe("case conversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCaseConversation).mockResolvedValue({ messages: [], notifications: [], visits: [] });
    vi.mocked(markCaseRead).mockResolvedValue(undefined);
    vi.mocked(sendCaseMessage).mockResolvedValue({ id: "message-1" } as never);
  });

  it("requires preview and sends a participant reply only to support", async () => {
    render(<CaseConversation caseId="case-1" bookingId="booking-1" viewerRole="provider" />);
    await screen.findByText(/No messages yet/);
    const send = screen.getByRole("button", { name: "Send update" });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "I arrived at the booked address and called the client." } });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Preview update" }));
    expect(screen.getByText(/Preview · To support/)).toBeVisible();
    fireEvent.click(send);
    await waitFor(() => expect(sendCaseMessage).toHaveBeenCalledOnce());
    expect(sendCaseMessage).toHaveBeenCalledWith(expect.objectContaining({ caseId: "case-1", audience: "admin" }));
  });

  it("shows received updates and marks them read", async () => {
    vi.mocked(getCaseConversation).mockResolvedValue({ messages: [{ id: "message-1", case_id: "case-1",
      author_id: "admin-1", author_role: "admin", audience: "provider",
      body: "Please send your arrival time and any supporting evidence.", storage_path: null,
      operation_id: "op-1", created_at: "2026-10-03T08:00:00Z" }], notifications: [{ id: "notice-1",
      case_id: "case-1", message_id: "message-1", recipient_id: "provider-1", created_at: "2026-10-03T08:00:00Z", read_at: null }], visits: [] });
    render(<CaseConversation caseId="case-1" bookingId="booking-1" viewerRole="provider" />);
    expect(await screen.findByText(/Please send your arrival time/)).toBeVisible();
    await waitFor(() => expect(markCaseRead).toHaveBeenCalledWith("case-1"));
  });

  it("previews message evidence in-app without opening a tab", async () => {
    vi.mocked(getCaseConversation).mockResolvedValue({ messages: [{ id: "message-2", case_id: "case-1",
      author_id: "admin-1", author_role: "admin", audience: "provider",
      body: "Please review the attached photo from this appointment.", storage_path: "booking/case/photo.jpg",
      operation_id: "op-2", created_at: "2026-10-03T08:00:00Z" }], notifications: [], visits: [] });
    vi.mocked(openCaseImage).mockResolvedValue("https://example.test/signed-image");
    const openTab = vi.spyOn(window, "open");
    render(<CaseConversation caseId="case-1" bookingId="booking-1" viewerRole="provider" />);
    fireEvent.click(await screen.findByRole("button", { name: "Preview evidence photo" }));
    expect(await screen.findByRole("img", { name: "Case message evidence" })).toBeVisible();
    expect(openTab).not.toHaveBeenCalled();
    openTab.mockRestore();
  });
});
