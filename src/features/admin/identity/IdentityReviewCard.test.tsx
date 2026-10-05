import { fireEvent, render, screen } from "@testing-library/react";
import { IdentityReviewCard } from "./IdentityReviewCard";
import type { IdentityReview } from "./types";

const approved: IdentityReview = {
  id: "review-1", user_id: "user-1", submitted_by_email: "applicant@example.com",
  submitted_app_role: "client", document_type: "UMID", source: "MANUAL_UPLOAD",
  status: "APPROVED", created_at: "2026-10-05T08:00:00Z", expected_decision_by: "2026-10-09T08:00:00Z",
  duplicate_reason: null, duplicate_match_count: 0, reviewed_at: "2026-10-05T09:00:00Z",
  review_notes: null, decision_email_sent_at: "2026-10-05T09:01:00Z",
  email_delivery_status: "sent", email_delivery_error: null,
  verified_full_legal_name: "Jeremiah Catong Jose", didit_session_id: null,
};

describe("IdentityReviewCard", () => {
  it("distinguishes an approved decision and preserves its review details", () => {
    const onOpen = vi.fn();
    render(<IdentityReviewCard review={approved} onOpen={onOpen} />);
    const card = screen.getByRole("article");
    expect(card.querySelector("header")).toHaveClass("bg-emerald-50/80");
    expect(screen.getByText("Approved")).toHaveClass("bg-emerald-100");
    expect(screen.getByText("UMID · Manual upload")).toBeVisible();
    expect(screen.getByText("Decision recorded")).toBeVisible();
    expect(screen.getByText("sent")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View identity decision" }));
    expect(onOpen).toHaveBeenCalledWith("review-1");
  });

  it("keeps pending and rejected states visually distinct", () => {
    const { rerender } = render(<IdentityReviewCard review={{ ...approved, status: "PENDING_REVIEW", reviewed_at: null }} onOpen={vi.fn()} />);
    expect(screen.getByRole("article").querySelector("header")).toHaveClass("bg-amber-50/80");
    expect(screen.getByRole("button", { name: "Review identity" })).toBeVisible();
    rerender(<IdentityReviewCard review={{ ...approved, status: "DECLINED" }} onOpen={vi.fn()} />);
    expect(screen.getByRole("article").querySelector("header")).toHaveClass("bg-destructive/5");
    expect(screen.getByText("Rejected")).toHaveClass("bg-destructive/10");
  });
});
