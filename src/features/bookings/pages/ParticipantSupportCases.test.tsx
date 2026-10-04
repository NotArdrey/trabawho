import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("shows a confirmed replacement cue before either participant opens the case", () => {
    vi.mocked(useParticipantSupportCases).mockReturnValue({
      items: [{ ...item, report: { ...item.report, resolution_status: "replacement_accepted" },
        replacementSchedule: { bookingId: "booking-123", caseId: "case-123", status: "accepted",
          startAt: "2026-10-10T08:00:00+08:00", endAt: "2026-10-10T09:00:00+08:00" } }],
      loading: false, error: "", refresh: vi.fn(),
    });
    render(<MemoryRouter initialEntries={["/support-cases"]}>
      <ParticipantSupportCases sellerProfile={{ userId: "client-1", role: "client" }} />
    </MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Your new visit" })).toBeVisible();
    expect(screen.getByText(/Saturday, October 10, 2026/)).toBeVisible();
    expect(screen.getByText(/8:00 AM–9:00 AM PHT/)).toBeVisible();
    expect(screen.getByText(/Both participants accepted this new schedule/)).toBeVisible();
    expect(screen.getByText(/This case has 1 new update/)).toBeVisible();
  });

  it("does not invent a time when a confirmed schedule could not be loaded", () => {
    vi.mocked(useParticipantSupportCases).mockReturnValue({
      items: [{ ...item, report: { ...item.report, resolution_status: "replacement_accepted" } }],
      loading: false, error: "", refresh: vi.fn(),
    });
    render(<MemoryRouter initialEntries={["/support-cases"]}>
      <ParticipantSupportCases sellerProfile={{ userId: "client-1", role: "client" }} />
    </MemoryRouter>);
    expect(screen.getByText(/confirmed time could not be displayed/)).toBeVisible();
  });

  it("pages member cases and returns to the first page after a search", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({ ...item,
      report: { ...item.report, id: `case-${index + 1}`, reason: `Issue ${index + 1}` }, unreadCount: 0,
    })) as ParticipantSupportCase[];
    vi.mocked(useParticipantSupportCases).mockReturnValue({ items, loading: false, error: "", refresh: vi.fn() });
    render(<MemoryRouter initialEntries={["/support-cases"]}>
      <ParticipantSupportCases sellerProfile={{ userId: "client-1", role: "client" }} />
    </MemoryRouter>);
    expect(screen.getByText("Issue 1")).toBeVisible();
    expect(screen.queryByText("Issue 9")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getByText("Issue 9")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search support cases" }), { target: { value: "Issue 1" } });
    expect(screen.getByText("Issue 1")).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Support case pages" })).not.toBeInTheDocument();
  });
});
