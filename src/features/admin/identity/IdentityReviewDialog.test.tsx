import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentityReviewDialog } from "./IdentityReviewDialog";
const mocks = vi.hoisted(() => ({ decide: vi.fn(), retry: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/admin/services/adminIdentityService", () => ({ decideIdentityReview: mocks.decide, retryIdentityEmail: mocks.retry }));
vi.mock("@/features/admin/hooks/useIdentityReviews", () => ({ useIdentityReviewDetail: () => ({ loading: false, refresh: mocks.refresh, data: {
  review: { status: "PENDING_REVIEW", document_type: "UMID", duplicate_reason: null, duplicate_match_count: 0 },
  profile: { full_name: "Juan Dela Cruz", email: "juan@example.com", role: "client", province: "La Union", city: "Balaoan", barangay: "Almeida", address: "12 Main Street", account_status: "active", id_document_expiry: "2030-01-01" },
  images: [], warnings: [], didit: null, history: [],
} }) }));
describe("identity review decisions", () => {
  beforeEach(() => vi.clearAllMocks());
  it("requires evidence acknowledgement, a reason, and explicit confirmation", async () => {
    const user = userEvent.setup();
    mocks.decide.mockResolvedValue({ status: "APPROVED", emailDelivery: { sent: true, required: true, status: "sent" } });
    render(<IdentityReviewDialog reviewId="review-1" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/12 Main Street, Almeida, Balaoan, La Union/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Approve identity" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/20 to 2000/);
    await user.type(screen.getByLabelText("Decision reason"), "The document and selfie match the applicant.");
    await user.click(screen.getByRole("button", { name: "Approve identity" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/reviewed the identity evidence/);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Approve identity" }));
    expect(mocks.decide).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm approval" }));
    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ decision: "APPROVED", evidenceReviewed: true, reason: "The document and selfie match the applicant." }));
    expect(await screen.findByRole("status")).toHaveTextContent(/confirm their email/);
  });
  it("preserves the reason and operation ID when a failed decision is retried", async () => {
    const user = userEvent.setup(); mocks.decide.mockRejectedValue(new Error("The request failed."));
    render(<IdentityReviewDialog reviewId="review-2" onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText("Decision reason"), "The document cannot be read clearly enough.");
    await user.click(screen.getByRole("button", { name: "Reject identity" }));
    await user.click(screen.getByRole("button", { name: "Confirm rejection" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The request failed.");
    await user.click(screen.getByRole("button", { name: "Confirm rejection" }));
    expect(mocks.decide.mock.calls[0]).toEqual(mocks.decide.mock.calls[1]);
  });
});
