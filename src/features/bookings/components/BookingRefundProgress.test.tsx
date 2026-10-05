import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBookingRefunds, hasVerifiedRefundPayment, processCaseRefunds, requestCaseRefund } from "../services/bookingRefunds";
import { BookingRefundProgress } from "./BookingRefundProgress";

vi.mock("../services/bookingRefunds", () => ({ getBookingRefunds: vi.fn(), hasVerifiedRefundPayment: vi.fn(), processCaseRefunds: vi.fn(), requestCaseRefund: vi.fn() }));
const props = { bookingId: "booking-1", caseId: "case-1", canRequest: true, onChanged: vi.fn() };
describe("dispute refund progress", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getBookingRefunds).mockResolvedValue([]); vi.mocked(hasVerifiedRefundPayment).mockResolvedValue(true); });
  it("does not offer refund review when the booking has no verified payment attempt", async () => {
    vi.mocked(hasVerifiedRefundPayment).mockResolvedValue(false);
    render(<BookingRefundProgress {...props} />);
    await waitFor(() => expect(hasVerifiedRefundPayment).toHaveBeenCalledWith("booking-1"));
    expect(screen.queryByText("Refund review")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request refund review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check refund status" })).not.toBeInTheDocument();
    expect(requestCaseRefund).not.toHaveBeenCalled();
  });
  it("does not show a refund remedy for a seeded demo payment", async () => {
    render(<BookingRefundProgress {...props} demoBooking />);
    await waitFor(() => expect(getBookingRefunds).toHaveBeenCalled());
    expect(screen.queryByText("Refund review")).not.toBeInTheDocument();
    expect(hasVerifiedRefundPayment).not.toHaveBeenCalled();
  });
  it("shows a system-queued payment exception without asking the client to request it again", async () => {
    render(<BookingRefundProgress {...props} systemQueued />);
    expect(await screen.findByText("Support review queued")).toBeVisible();
    expect(screen.getByText(/No refund has been completed/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request refund review" })).not.toBeInTheDocument();
    expect(hasVerifiedRefundPayment).not.toHaveBeenCalled();
  });
  it("holds the request while payment verification cannot be checked and allows retry", async () => {
    vi.mocked(hasVerifiedRefundPayment).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    render(<BookingRefundProgress {...props} />);
    expect(await screen.findByRole("button", { name: "Retry payment check" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request refund review" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry payment check" }));
    expect(await screen.findByRole("button", { name: "Request refund review" })).toBeVisible();
  });
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
  it("labels a completed sandbox refund without claiming that money was returned", async () => {
    vi.mocked(getBookingRefunds).mockResolvedValue([{ id: "refund-1", case_id: "case-1", payment_attempt_id: "attempt-1",
      amount: 464, currency: "PHP", status: "simulated", provider_refund_id: null, updated_at: "2026-10-05T08:00:00Z" }]);
    render(<BookingRefundProgress {...props} canRequest={false} />);
    expect(await screen.findByText(/PHP 464.00.*Test review recorded/)).toBeVisible();
    expect(screen.getByText("Review complete")).toBeVisible();
    expect(screen.getByText(/PayMongo did not return money for them/)).toBeVisible();
    expect(screen.queryByText(/simulat/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check refund status" })).not.toBeInTheDocument();
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
  it("does not offer a competing refund request after a replacement is accepted", async () => {
    render(<BookingRefundProgress {...props} replacementAccepted />);
    await waitFor(() => expect(getBookingRefunds).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Request refund review" })).not.toBeInTheDocument();
    expect(screen.queryByText("Refund review")).not.toBeInTheDocument();
  });
  it("still shows an existing refund record after replacement acceptance", async () => {
    vi.mocked(getBookingRefunds).mockResolvedValue([{ id: "refund-1", case_id: "case-1", payment_attempt_id: "attempt-1",
      amount: 464, currency: "PHP", status: "pending", provider_refund_id: "ref-1", updated_at: "2026-10-03T08:00:00Z" }]);
    render(<BookingRefundProgress {...props} replacementAccepted />);
    expect(await screen.findByText(/PHP 464.00/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request refund review" })).not.toBeInTheDocument();
  });
});
