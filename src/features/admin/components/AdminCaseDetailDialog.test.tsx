import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSupportCaseDetail, recordSupportFollowup, type SupportCase } from "@/features/admin/services/adminSupportService";
import { AdminCaseDetailDialog } from "./AdminCaseDetailDialog";

vi.mock("@/features/admin/services/adminSupportService", () => ({
  getSupportCaseDetail: vi.fn(), recordSupportFollowup: vi.fn(), openSupportEvidence: vi.fn(),
}));

const item = {
  id: "case-1", booking_id: "booking-1", reporter_id: "client-1",
  case_type: "provider_no_show", reason: "Provider did not arrive at our scheduled appointment.",
  policy_route: "support_review", policy_reason: null, storage_path: null,
  status: "under_review", created_at: "2026-10-02T08:00:00Z",
} as SupportCase;

const detail = {
  booking: { id: "booking-1", buyer_id: "client-1", seller_id: "provider-1", service_id: 44,
    status: "confirmed", start_ts: "2026-10-02T08:00:00Z", end_ts: "2026-10-02T09:00:00Z",
    total_amount: 900, currency: "PHP", payment_reference: null, schedule_status: "confirmed", work_started_at: null },
  people: [{ user_id: "client-1", full_name: "Demo Client", email: "client@example.test" },
    { user_id: "provider-1", full_name: "Demo Provider", email: "provider@example.test" }],
  service: { id: 44, title: "Computer repair" },
  payments: [{ id: "payment-1", purpose: "initial", status: "paid", amount: 495,
    currency: "PHP", created_at: "2026-10-02T07:00:00Z", paid_at: "2026-10-02T07:05:00Z" }],
  audit: [], caseActions: [], adminActions: [], delivery: [], unavailable: [],
} as Awaited<ReturnType<typeof getSupportCaseDetail>>;

describe("AdminCaseDetailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupportCaseDetail).mockResolvedValue(detail);
  });

  it("shows source-labelled facts and does not claim a refund", async () => {
    render(<AdminCaseDetailDialog item={item} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText("Demo Provider")).toBeVisible();
    expect(screen.getByText(/initial: PHP 495 · paid/i)).toBeVisible();
    expect(screen.getByText(/No action here moves money/)).toBeVisible();
  });

  it("records a support referral once and keeps money unchanged", async () => {
    vi.mocked(recordSupportFollowup).mockResolvedValue({ id: 1 } as never);
    const onSaved = vi.fn();
    render(<AdminCaseDetailDialog item={item} onClose={vi.fn()} onSaved={onSaved} />);
    await screen.findByText("Demo Provider");
    fireEvent.click(screen.getByRole("combobox", { name: "Action" }));
    fireEvent.click(screen.getByRole("option", { name: "Refer for refund review" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Reason and next step" }), {
      target: { value: "The provider did not arrive; support must review refund eligibility." },
    });
    const submit = screen.getByRole("button", { name: "Record follow-up" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(recordSupportFollowup).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.getByText(/No payment or refund was changed/i)).toBeVisible();
  });

  it("blocks action when important records are unavailable", async () => {
    vi.mocked(getSupportCaseDetail).mockResolvedValue({ ...detail, unavailable: ["Payment attempts"] });
    render(<AdminCaseDetailDialog item={item} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText(/Some records could not be loaded/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Record follow-up" })).toBeDisabled();
  });

  it("offers a retry when booking details fail to load", async () => {
    vi.mocked(getSupportCaseDetail).mockRejectedValueOnce(new Error("The booking for this case could not be loaded."))
      .mockResolvedValueOnce(detail);
    render(<AdminCaseDetailDialog item={item} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The booking for this case could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading details" }));
    expect(await screen.findByText("Demo Provider")).toBeVisible();
  });
});

describe("support follow-up save recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps a saved follow-up successful when the subsequent history load fails", async () => {
    vi.mocked(getSupportCaseDetail).mockResolvedValueOnce(detail).mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(detail);
    vi.mocked(recordSupportFollowup).mockResolvedValueOnce({ id: 1, case_id: item.id, actor_id: "admin-1",
      action: "request_information", target_party: "both", reason: "Please provide the booking attendance evidence.",
      operation_id: "op-1", created_at: "2026-10-02T14:18:00Z" });
    const onSaved = vi.fn();
    render(<AdminCaseDetailDialog item={item} onClose={vi.fn()} onSaved={onSaved} />);
    await screen.findByRole("heading", { name: "Record a next step" });
    fireEvent.change(screen.getByRole("textbox", { name: "Reason and next step" }), {
      target: { value: "Please provide the booking attendance evidence." },
    });
    const save = screen.getByRole("button", { name: "Record follow-up" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(await screen.findByText("Support follow-up recorded. No payment or refund was changed.")).toBeVisible();
    await screen.findByText(/follow-up was saved, but the updated history could not be loaded/i);
    expect(recordSupportFollowup).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "Reason and next step" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading details" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry loading details" })).not.toBeInTheDocument());
    expect(recordSupportFollowup).toHaveBeenCalledOnce();
  });
});
