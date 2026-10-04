import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceRepairRework } from "@/features/bookings/services/bookingTransactions";
import { RepairCaseResolution } from "./RepairCaseResolution";

vi.mock("@/features/bookings/services/bookingTransactions", () => ({ advanceRepairRework: vi.fn() }));

const report = {
  id: "case-1", case_type: "warranty_issue", reason: "The printer failed again after repair.",
  policy_route: "rework_request" as const, policy_reason: "In window", status: "open" as const,
  created_at: "2026-10-02T00:00:00Z", provider_response_action: "offer_rework" as const,
  provider_response_text: "I will inspect and redo the work.", provider_responded_at: "2026-10-02T01:00:00Z",
  refund_requested_at: null, latest_support_action: null, latest_support_target: null, latest_support_at: null,
  resolution_status: null,
  rework_state: null, rework_appointment_at: null, rework_evidence_note: null,
  rework_delivered_at: null, rework_confirmed_at: null, rework_escalated_at: null,
};

describe("RepairCaseResolution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers a return visit only to the provider, while the client can escalate", () => {
    const { rerender } = render(<RepairCaseResolution bookingId="booking-1" caseRecord={report} viewerRole="provider" onCaseChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Propose return visit" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request support review" })).not.toBeInTheDocument();
    rerender(<RepairCaseResolution bookingId="booking-1" caseRecord={report} viewerRole="client" onCaseChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Propose return visit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request support review" })).toBeVisible();
  });

  it("accepts a future proposed visit and prevents duplicate clicks", async () => {
    const appointment = new Date(Date.now() + 86_400_000).toISOString();
    let finish: ((result: Awaited<ReturnType<typeof advanceRepairRework>>) => void) | undefined;
    vi.mocked(advanceRepairRework).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const onCaseChanged = vi.fn();
    render(<RepairCaseResolution bookingId="booking-1" caseRecord={{ ...report,
      rework_state: "appointment_proposed", rework_appointment_at: appointment,
    }} viewerRole="client" onCaseChanged={onCaseChanged} />);
    const accept = screen.getByRole("button", { name: "Accept return visit" });
    fireEvent.click(accept);
    fireEvent.click(accept);
    expect(advanceRepairRework).toHaveBeenCalledTimes(1);
    expect(accept).toBeDisabled();
    finish?.({ booking: { id: "booking-1" }, case: { ...report, rework_state: "appointment_accepted", rework_appointment_at: appointment } });
    await waitFor(() => expect(onCaseChanged).toHaveBeenCalledOnce());
  });

  it("does not let the provider claim rework before the accepted appointment", () => {
    const appointment = new Date(Date.now() + 86_400_000).toISOString();
    render(<RepairCaseResolution bookingId="booking-1" caseRecord={{ ...report,
      rework_state: "appointment_accepted", rework_appointment_at: appointment,
    }} viewerRole="provider" onCaseChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Submit rework notes" })).not.toBeInTheDocument();
    expect(screen.getByText(/30 minutes before the accepted visit/i)).toBeVisible();
  });

  it("requires a client confirmation to close the case and offers escalation", async () => {
    const onCaseChanged = vi.fn();
    const delivered = { ...report, rework_state: "rework_delivered" as const,
      rework_appointment_at: new Date(Date.now() - 86_400_000).toISOString(),
      rework_evidence_note: "I replaced the failed part and tested the printer.",
      rework_delivered_at: new Date().toISOString() };
    vi.mocked(advanceRepairRework).mockResolvedValue({ booking: { id: "booking-1" }, case: {
      ...delivered, status: "closed", rework_state: "resolved_by_client",
    } } as never);
    render(<RepairCaseResolution bookingId="booking-1" caseRecord={delivered} viewerRole="client" onCaseChanged={onCaseChanged} />);
    expect(screen.getByText("I replaced the failed part and tested the printer.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Request support review" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm rework" }));
    expect(screen.getByText(/does not change the original payment/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and close case" }));
    await waitFor(() => expect(onCaseChanged).toHaveBeenCalledOnce());
    expect(advanceRepairRework).toHaveBeenCalledWith(expect.objectContaining({ action: "confirm_rework" }));
  });

  it("keeps a failed escalation editable for retry", async () => {
    vi.mocked(advanceRepairRework).mockRejectedValueOnce(new Error("Try again"));
    render(<RepairCaseResolution bookingId="booking-1" caseRecord={report} viewerRole="client" onCaseChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Request support review" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Why do you need support?" }), {
      target: { value: "The repair did not fix the original printer problem." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send to support" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.getByRole("textbox", { name: "Why do you need support?" }))
      .toHaveValue("The repair did not fix the original printer problem.");
  });
});
