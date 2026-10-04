import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBookingRefunds, processCaseRefunds, requestCaseRefund } from "../services/bookingRefunds";
import { BookingRefundProgress } from "./BookingRefundProgress";

vi.mock("../services/bookingRefunds", () => ({ getBookingRefunds: vi.fn(), processCaseRefunds: vi.fn(), requestCaseRefund: vi.fn() }));
const props = { bookingId: "booking-1", caseId: "case-1", canRequest: true, onChanged: vi.fn() };
describe("dispute refund progress", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getBookingRefunds).mockResolvedValue([]); });
  it("requests review once without claiming that money was returned", async () => {
    let finish: (() => void) | undefined;
    vi.mocked(requestCaseRefund).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<BookingRefundProgress {...props} />);
    const request = await screen.findByRole("button", { name: "Request refund review" });
    fireEvent.click(request); fireEvent.click(request);
    expect(requestCaseRefund).toHaveBeenCalledTimes(1);
    expect(request).toBeDisabled();
    finish?.();
    expect(await screen.findByRole("status")).toHaveTextContent("Support must approve");
    expect(processCaseRefunds).not.toHaveBeenCalled();
  });
  it("displays the verified reference and amount to either participant", async () => {
    vi.mocked(getBookingRefunds).mockResolvedValue([{ id: "refund-1", case_id: "case-1", payment_attempt_id: "attempt-1", amount: 464, currency: "PHP", status: "succeeded", provider_refund_id: "ref_verified", updated_at: "2026-10-03T08:00:00Z" }]);
    render(<BookingRefundProgress {...props} canRequest={false} />);
    expect(await screen.findByText(/PHP 464.00/)).toHaveTextContent("Refund sent to original payment method");
    expect(screen.getByText(/ref_verified/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request refund review" })).not.toBeInTheDocument();
  });
  it("summarizes split refunds while keeping each provider reference visible", async () => {
    vi.mocked(getBookingRefunds).mockResolvedValue([
      { id: "refund-1", case_id: "case-1", payment_attempt_id: "attempt-1", amount: 325, currency: "PHP", status: "succeeded", provider_refund_id: "ref_first", updated_at: "2026-10-03T08:00:00Z" },
      { id: "refund-2", case_id: "case-1", payment_attempt_id: "attempt-2", amount: 357.5, currency: "PHP", status: "succeeded", provider_refund_id: "ref_second", updated_at: "2026-10-03T08:00:00Z" },
    ]);
    render(<BookingRefundProgress {...props} canRequest={false} />);
    expect(await screen.findByText("PHP 682.50 sent across 2 refunds.")).toBeVisible();
    expect(screen.getByText(/ref_first/)).toBeVisible();
    expect(screen.getByText(/ref_second/)).toBeVisible();
  });
  it("preserves failed requests and permits a retry", async () => {
    vi.mocked(requestCaseRefund).mockRejectedValueOnce(new Error("Check your connection")).mockResolvedValueOnce();
    render(<BookingRefundProgress {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Request refund review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection");
    fireEvent.click(screen.getByRole("button", { name: "Request refund review" }));
    await waitFor(() => expect(requestCaseRefund).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent("Refund review requested");
  });
});
