import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBookingRefunds, processCaseRefunds } from "@/features/bookings";
import { AdminRefundDecision } from "./AdminRefundDecision";

vi.mock("@/features/bookings/services/bookingRefunds", () => ({ getBookingRefunds: vi.fn(), processCaseRefunds: vi.fn(), requestCaseRefund: vi.fn() }));
const props = { bookingId: "booking-1", caseId: "case-1", paidAmount: 464, closed: false, incomplete: false, onSaved: vi.fn() };
describe("admin refund decision", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getBookingRefunds).mockResolvedValue([]); });
  it("requires a reason and confirmation before issuing money", async () => {
    vi.mocked(processCaseRefunds).mockResolvedValue({ checked: true, needsRetry: false });
    render(<AdminRefundDecision {...props} />);
    const approve = await screen.findByRole("button", { name: "Approve full refund" });
    expect(approve).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Refund approval reason" }), { target: { value: "The provider did not attend the confirmed booking." } });
    fireEvent.click(approve);
    expect(processCaseRefunds).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("PHP 464");
    fireEvent.click(screen.getByRole("button", { name: "Keep reviewing" }));
    expect(processCaseRefunds).not.toHaveBeenCalled();
    fireEvent.click(approve);
    fireEvent.click(screen.getByRole("button", { name: "Confirm full refund" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Refund status checked");
    expect(processCaseRefunds).toHaveBeenCalledExactlyOnceWith("case-1", "The provider did not attend the confirmed booking.", 464);
  });
  it("blocks approval while evidence is unavailable", async () => {
    render(<AdminRefundDecision {...props} incomplete />);
    const approve = await screen.findByRole("button", { name: "Approve full refund" });
    fireEvent.change(screen.getByRole("textbox", { name: "Refund approval reason" }), { target: { value: "The provider did not attend the confirmed booking." } });
    expect(approve).toBeDisabled();
  });
});
