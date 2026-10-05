import { fireEvent, render, screen, within } from "@testing-library/react";
import { useIdentityReviews } from "@/features/admin/hooks/useIdentityReviews";
import AdminIdentityReviews from "./AdminIdentityReviews";

vi.mock("@/features/admin/hooks/useIdentityReviews", () => ({ useIdentityReviews: vi.fn() }));
vi.mock("./IdentityReviewDialog", () => ({ IdentityReviewDialog: () => null }));

describe("identity review filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIdentityReviews).mockReturnValue({ data: { items: [], total: 0, page: 1, pageSize: 10 },
      loading: false, error: undefined, refresh: vi.fn() });
  });

  it("keeps pending as the default and exposes past decisions in the shared status rail", () => {
    render(<AdminIdentityReviews />);
    expect(useIdentityReviews).toHaveBeenLastCalledWith({ page: 1, status: "PENDING_REVIEW", search: "" });
    const toolbar = screen.getByRole("toolbar", { name: "Review status" });
    expect(within(toolbar).getByRole("button", { name: "Pending review" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(toolbar).getByRole("button", { name: "Approved" }));
    expect(useIdentityReviews).toHaveBeenLastCalledWith({ page: 1, status: "APPROVED", search: "" });
    expect(screen.getByText(/No reviews match this email and status/)).toBeVisible();
  });

  it("submits email search explicitly and clears the applied search with the shared control", () => {
    render(<AdminIdentityReviews />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search applicant email" }), { target: { value: "  ana@example.com  " } });
    expect(useIdentityReviews).toHaveBeenLastCalledWith({ page: 1, status: "PENDING_REVIEW", search: "" });
    fireEvent.submit(screen.getByRole("form", { name: "Search identity reviews" }));
    expect(useIdentityReviews).toHaveBeenLastCalledWith({ page: 1, status: "PENDING_REVIEW", search: "ana@example.com" });
    fireEvent.click(screen.getByRole("button", { name: "Clear applicant email" }));
    expect(useIdentityReviews).toHaveBeenLastCalledWith({ page: 1, status: "PENDING_REVIEW", search: "" });
  });
});
