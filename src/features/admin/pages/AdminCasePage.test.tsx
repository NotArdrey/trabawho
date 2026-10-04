import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { claimSupportCase, getCurrentAdminId, getSupportCaseById, getSupportCaseDetail,
  type SupportCase } from "@/features/admin/services/adminSupportService";
import { AdminCasePage } from "./AdminCasePage";

vi.mock("@/features/admin/services/adminSupportService", () => ({
  claimSupportCase: vi.fn(), getCurrentAdminId: vi.fn(), getSupportCaseById: vi.fn(),
  getSupportCaseDetail: vi.fn(), openSupportEvidence: vi.fn(), recordSupportFollowup: vi.fn(),
}));
vi.mock("@/features/admin/components/AdminRefundDecision", () => ({ AdminRefundDecision: () => <p>Refund decision</p> }));
vi.mock("@/features/admin/components/AdminReplacementProposal", () => ({ AdminReplacementProposal: () => <p>Replacement proposal</p> }));
vi.mock("@/features/bookings/components/BookingRefundProgress", () => ({ BookingRefundProgress: () => <p>Refund progress</p> }));
vi.mock("@/features/bookings/components/CaseConversation", () => ({
  CaseConversation: ({ readOnly }: { readOnly: boolean }) => <p>Conversation {readOnly ? "read only" : "editable"}</p>,
}));
vi.mock("@/features/bookings/components/CaseReviewPanel", () => ({
  CaseReviewPanel: ({ readOnly }: { readOnly: boolean }) => <p>Review {readOnly ? "read only" : "editable"}</p>,
}));

const item = {
  id: "ef8283c5-8f25-4560-b76a-4b229f4e85a8", booking_id: "booking-1", reporter_id: "client-1",
  case_type: "provider_no_show", reason: "The provider did not arrive at our appointment.",
  status: "under_review", resolution_status: "reviewing", policy_route: "support_review", policy_reason: null,
  assigned_admin_id: "other-admin", response_due_at: null, created_at: "2026-10-03T08:00:00Z",
  refund_requested_at: null, storage_path: null,
} as SupportCase;
const detail = {
  booking: { id: "booking-1", buyer_id: "client-1", seller_id: "provider-1", service_id: 1,
    status: "confirmed", start_ts: "2026-10-03T08:00:00Z", end_ts: "2026-10-03T09:00:00Z",
    total_amount: 900, currency: "PHP", payment_reference: null, schedule_status: "confirmed", work_started_at: null },
  people: [], service: { id: 1, title: "Repair" }, payments: [], providerEvents: [],
  audit: [], caseActions: [], adminActions: [], delivery: [], caseMessages: [], unavailable: [],
} as Awaited<ReturnType<typeof getSupportCaseDetail>>;

function renderCase() {
  render(<MemoryRouter initialEntries={["/admin/support-cases/ef8283c5-8f25-4560-b76a-4b229f4e85a8"]}>
    <AdminCasePage caseId="ef8283c5-8f25-4560-b76a-4b229f4e85a8" />
  </MemoryRouter>);
}

describe("AdminCasePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentAdminId).mockResolvedValue("current-admin");
    vi.mocked(getSupportCaseById).mockResolvedValue(item);
    vi.mocked(getSupportCaseDetail).mockResolvedValue(detail);
  });

  it("loads a case by ID and keeps another admin's actions read-only", async () => {
    renderCase();
    expect(await screen.findByRole("heading", { name: "Payment status" })).toBeVisible();
    expect(screen.getByText(/another support admin/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Take ownership" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conversation" }));
    expect(screen.getByText("Conversation read only")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Resolution" }));
    expect(screen.getByText("Review read only")).toBeVisible();
    expect(screen.getByText("Refund progress")).toBeVisible();
  });

  it("requires explicit claim before presenting case actions", async () => {
    vi.mocked(getSupportCaseById).mockResolvedValue({ ...item, assigned_admin_id: null });
    vi.mocked(claimSupportCase).mockResolvedValue({ ...item, assigned_admin_id: "current-admin" });
    renderCase();
    fireEvent.click(await screen.findByRole("button", { name: "Take ownership" }));
    await waitFor(() => expect(claimSupportCase).toHaveBeenCalledWith(item.id));
  });

  it("does not invent details for an unavailable case", async () => {
    vi.mocked(getSupportCaseById).mockResolvedValue(null);
    renderCase();
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable to your account/i);
    expect(screen.queryByRole("heading", { name: "Payment status" })).not.toBeInTheDocument();
  });

  it("keeps payment context visible and opens the secondary history disclosure", async () => {
    renderCase();
    expect(await screen.findByRole("heading", { name: "Reported issue" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "People and appointment" })).toBeVisible();
    expect(screen.getByText(/No confirmed PayMongo payment is linked to this booking/)).toBeVisible();
    expect(screen.getByText(/The booking price is not proof that payment was received/)).toBeVisible();
    const disclosure = screen.getByText("History and technical references").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("History and technical references"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("Case: ef8283c5-8f25-4560-b76a-4b229f4e85a8")).toBeVisible();
  });

  it("groups evidence and separates participant conversation from private notes", async () => {
    renderCase();
    await screen.findByRole("heading", { name: "Payment status" });
    fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
    expect(screen.getByRole("heading", { name: "Report evidence" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Delivery evidence" })).toBeVisible();
    expect(screen.getByText("No payment attempts visible.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Conversation" }));
    expect(screen.getByRole("heading", { name: "Private admin notes" })).toBeVisible();
    expect(screen.getByText(/Only support admins can read these notes/)).toBeVisible();
  });
});
