import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCaseReviewRequests } from "@/features/bookings/services/caseWorkflow";
import { CaseReviewPanel } from "./CaseReviewPanel";

vi.mock("@/features/bookings/services/caseWorkflow", () => ({
  getCaseReviewRequests: vi.fn(),
  requestCaseReview: vi.fn(),
  decideCaseReview: vi.fn(),
}));

describe("CaseReviewPanel", () => {
  beforeEach(() => { vi.mocked(getCaseReviewRequests).mockResolvedValue([]); });

  it("does not show an empty review action on an active participant case", async () => {
    render(<CaseReviewPanel caseId="case-1" viewerRole="client" closed={false} onChanged={vi.fn()} />);
    await waitFor(() => expect(getCaseReviewRequests).toHaveBeenCalledWith("case-1"));
    expect(screen.queryByRole("heading", { name: "Further review" })).not.toBeInTheDocument();
  });

  it("offers further review after the case closes", async () => {
    render(<CaseReviewPanel caseId="case-1" viewerRole="client" closed onChanged={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Further review" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Request further review" })).toBeDisabled();
  });
});
