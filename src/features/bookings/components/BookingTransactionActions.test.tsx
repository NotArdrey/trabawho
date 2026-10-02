import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { performBookingLifecycleAction } from "@/features/bookings/services/bookingLifecycle";
import { getBookingSupportCase, openBookingSupportCase, respondToRepairClaim, startBookingWork } from "@/features/bookings/services/bookingTransactions";
import { BookingTransactionActions } from "./BookingTransactionActions";

vi.mock("@/features/bookings/services/bookingLifecycle", () => ({ performBookingLifecycleAction: vi.fn() }));
vi.mock("@/features/bookings/services/bookingTransactions", () => ({
  startBookingWork: vi.fn(), deliverBookingWithEvidence: vi.fn(),
  openBookingSupportCase: vi.fn(), getBookingDeliveryEvidence: vi.fn(), getBookingSupportCase: vi.fn(),
  respondToRepairClaim: vi.fn(),
}));

const booking = {
  id: "booking-1", paymentStatus: "paid", scheduleStatus: "confirmed",
  deliveryStatus: "not_delivered", disputeStatus: "none", scheduleVersion: 2,
  appointmentStartAt: "2026-01-01T09:00:00Z", workStartedAt: null,
  raw: { booking: { status: "confirmed" } },
};
const emptyRework = {
  rework_state: null, rework_appointment_at: null, rework_evidence_note: null,
  rework_delivered_at: null, rework_confirmed_at: null, rework_escalated_at: null,
};

describe("BookingTransactionActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks work controls while the balance is unpaid", () => {
    render(<BookingTransactionActions booking={{ ...booking, paymentStatus: "partially_paid" }} viewerRole="provider" onUpdated={vi.fn()} />);
    expect(screen.getByText(/waiting for client balance/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit delivery" })).not.toBeInTheDocument();
  });

  it("starts work once despite duplicate clicks and refreshes the booking", async () => {
    let finish: ((value: unknown) => void) | undefined;
    vi.mocked(startBookingWork).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const onUpdated = vi.fn();
    render(<BookingTransactionActions booking={booking} viewerRole="provider" onUpdated={onUpdated} />);
    const start = screen.getByRole("button", { name: "Start work" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(startBookingWork).toHaveBeenCalledTimes(1);
    expect(start).toBeDisabled();
    finish?.({ ...booking, workStartedAt: "2026-10-02T09:00:00Z" });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
  });

  it("shows completion only after delivery and a report option for the client", () => {
    const { rerender } = render(<BookingTransactionActions booking={booking} viewerRole="client" onUpdated={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Confirm completion" })).not.toBeInTheDocument();
    rerender(<BookingTransactionActions booking={{ ...booking, deliveryStatus: "seller_claimed" }} viewerRole="client" onUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Confirm completion" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeVisible();
    expect(screen.getByRole("button", { name: "View delivery proof" })).toBeVisible();
  });

  it("retries a failed completion without claiming success", async () => {
    vi.mocked(performBookingLifecycleAction).mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ ...booking, deliveryStatus: "buyer_confirmed" });
    const onUpdated = vi.fn();
    render(<BookingTransactionActions booking={{ ...booking, deliveryStatus: "seller_claimed" }} viewerRole="client" onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm completion" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Confirm completion" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
  });

  it("routes an in-window designated repair report to rework", () => {
    render(<BookingTransactionActions booking={{ ...booking, raw: { booking: { status: "completed" } },
      completedAt: new Date().toISOString(), warrantyEligible: true,
      warrantyPolicyCode: "repair_workmanship_7d", warrantyDurationDays: 7 }} viewerRole="client" onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(screen.getByText(/within the seven-day repair window/i)).toBeVisible();
    expect(screen.getByRole("option", { name: "Repair workmanship issue" })).toBeInTheDocument();
  });

  it("sends an out-of-window repair issue to support review", () => {
    const completedAt = new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString();
    render(<BookingTransactionActions booking={{ ...booking, raw: { booking: { status: "completed" } },
      completedAt, warrantyEligible: true, warrantyPolicyCode: "repair_workmanship_7d",
      warrantyDurationDays: 7 }} viewerRole="client" onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(screen.getByText(/outside the automatic repair route/i)).toBeVisible();
  });

  it("shows the provider a client rework request without claiming the defect was accepted", async () => {
    vi.mocked(getBookingSupportCase).mockResolvedValue({
      ...emptyRework,
      id: "case-1",
      case_type: "warranty_issue", reason: "The repaired printer stopped working again.",
      policy_route: "rework_request", policy_reason: "Provider response is needed.",
      status: "open", created_at: new Date().toISOString(),
      provider_response_action: null, provider_response_text: null, provider_responded_at: null,
    });
    render(<BookingTransactionActions booking={{ ...booking, disputeStatus: "open" }} viewerRole="provider" onUpdated={vi.fn()} />);
    expect(await screen.findByText("Client requested repair rework")).toBeVisible();
    expect(screen.getByText("The repaired printer stopped working again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Respond to repair claim" })).toBeVisible();
  });

  it("submits one provider response and shows it to both participants", async () => {
    const report = { id: "case-1", case_type: "warranty_issue", reason: "The repaired printer stopped working again.",
      ...emptyRework,
      policy_route: "rework_request" as const, policy_reason: "Provider response is needed.", status: "open" as const,
      created_at: new Date().toISOString(), provider_response_action: null, provider_response_text: null, provider_responded_at: null };
    vi.mocked(getBookingSupportCase).mockResolvedValueOnce(report).mockResolvedValue({ ...report,
      provider_response_action: "offer_rework", provider_response_text: "I can inspect the printer and repair the original work.",
      provider_responded_at: new Date().toISOString(),
    });
    vi.mocked(respondToRepairClaim).mockResolvedValue(booking);
    render(<BookingTransactionActions booking={{ ...booking, disputeStatus: "open" }} viewerRole="provider" onUpdated={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Respond to repair claim" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your response" }), {
      target: { value: "I can inspect the printer and repair the original work." },
    });
    const send = screen.getByRole("button", { name: "Send response" });
    fireEvent.click(send);
    fireEvent.click(send);
    expect(respondToRepairClaim).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Provider offered rework")).toBeVisible());
    expect(screen.queryByRole("button", { name: "Respond to repair claim" })).not.toBeInTheDocument();
  });

  it("keeps a failed response editable for retry", async () => {
    vi.mocked(getBookingSupportCase).mockResolvedValue({ id: "case-1", case_type: "warranty_issue",
      ...emptyRework,
      reason: "The repaired printer stopped working again.", policy_route: "rework_request",
      policy_reason: "Provider response is needed.", status: "open", created_at: new Date().toISOString(),
      provider_response_action: null, provider_response_text: null, provider_responded_at: null });
    vi.mocked(respondToRepairClaim).mockRejectedValueOnce(new Error("Network unavailable"));
    render(<BookingTransactionActions booking={{ ...booking, disputeStatus: "open" }} viewerRole="provider" onUpdated={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Respond to repair claim" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your response" }), {
      target: { value: "Please send this to support for review of the issue." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send response" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByRole("textbox", { name: "Your response" })).toHaveValue("Please send this to support for review of the issue.");
  });

  it("shows the saved response to the client without giving them provider controls", async () => {
    vi.mocked(getBookingSupportCase).mockResolvedValue({ id: "case-1", case_type: "warranty_issue",
      ...emptyRework,
      reason: "The repaired printer stopped working again.", policy_route: "rework_request",
      policy_reason: "Provider response is needed.", status: "under_review", created_at: new Date().toISOString(),
      provider_response_action: "request_support_review",
      provider_response_text: "The reported fault needs an independent review before rework.",
      provider_responded_at: new Date().toISOString() });
    render(<BookingTransactionActions booking={{ ...booking, disputeStatus: "open" }} viewerRole="client" onUpdated={vi.fn()} />);
    expect(await screen.findByText("Provider requested support review")).toBeVisible();
    expect(screen.getByText("The reported fault needs an independent review before rework.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Respond to repair claim" })).not.toBeInTheDocument();
  });

  it("uses the server route instead of the client's clock for the result message", async () => {
    vi.mocked(openBookingSupportCase).mockResolvedValue({ booking, policyRoute: "support_review" });
    render(<BookingTransactionActions booking={{ ...booking, raw: { booking: { status: "completed" } },
      completedAt: new Date().toISOString(), warrantyEligible: true,
      warrantyPolicyCode: "repair_workmanship_7d", warrantyDurationDays: 7 }} viewerRole="client" onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    fireEvent.change(screen.getByRole("textbox", { name: "What happened?" }), { target: { value: "The repair stopped working after handover." } });
    fireEvent.click(screen.getByRole("button", { name: "Open support case" }));
    expect(await screen.findByText(/Support case saved for review/i)).toBeVisible();
    expect(screen.queryByText(/Rework request saved/i)).not.toBeInTheDocument();
  });
});
