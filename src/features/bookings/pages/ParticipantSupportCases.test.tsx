import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useParticipantSupportCases } from "../hooks/useParticipantSupportCases";
import type { ParticipantSupportCase } from "../services/participantSupportCases";
import { ParticipantSupportCases } from "./ParticipantSupportCases";

vi.mock("@/shared/components/DashboardNavigation", () => ({ default: () => null }));
vi.mock("../hooks/useParticipantSupportCases", () => ({ useParticipantSupportCases: vi.fn() }));
vi.mock("../components/ParticipantCaseDetail", () => ({ ParticipantCaseDetail: () => <section id="case-conversation" tabIndex={-1}>Case conversation</section> }));

const item = { report: { id: "case-123", booking_id: "booking-123", case_type: "provider_no_show",
  reason: "The provider did not arrive.", status: "under_review", created_at: "2026-10-03T08:00:00Z" },
  serviceTitle: "Repair", counterpartName: "Provider", viewerRole: "client", unreadCount: 1 } as ParticipantSupportCase;
const scrollIntoView = vi.fn();

describe("participant case notification destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParticipantSupportCases).mockReturnValue({ items: [item], loading: false, error: "", refresh: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  });

  it("focuses the conversation when a case alert opens its deep link", async () => {
    render(<MemoryRouter initialEntries={["/support-cases?case=case-123#case-conversation"]}>
      <ParticipantSupportCases sellerProfile={{ userId: "client-1", role: "client" }} />
    </MemoryRouter>);
    const conversation = screen.getByText("Case conversation");
    await waitFor(() => expect(conversation).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });
});
