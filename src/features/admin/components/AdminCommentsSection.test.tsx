import { fireEvent, render, screen } from "@testing-library/react";
import AdminCommentsSection from "./AdminCommentsSection";
import type { AdminComment } from "../types";

const comment: AdminComment = { id: 1, worker: "Ana Provider", client: "Ben Client", rating: 5, comment: "Careful repair", status: "published", createdAt: "2026-10-02T00:00:00Z" };
const handlers = { onSearchChange: vi.fn(), onStatusChange: vi.fn(), onRatingChange: vi.fn(), onPageChange: vi.fn(), onRetry: vi.fn(), onOpenDeleteComment: vi.fn() };

function renderReviews(overrides: Partial<React.ComponentProps<typeof AdminCommentsSection>> = {}) {
  return render(<AdminCommentsSection comments={[comment]} isLoading={false} error="" total={21} page={1} pageSize={10} search="" status="all" rating="all" {...handlers} {...overrides} />);
}

describe("AdminCommentsSection", () => {
  beforeEach(() => vi.clearAllMocks());

  test("searches, filters, and pages reviews with accessible controls", () => {
    renderReviews();
    expect(screen.getByText("Showing 1–10 of 21 reviews")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Rating" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search written review comments" }), { target: { value: "repair" } });
    expect(handlers.onSearchChange).toHaveBeenCalledWith("repair");
    fireEvent.click(screen.getByRole("button", { name: "Unpublished" }));
    expect(handlers.onStatusChange).toHaveBeenCalledWith("unpublished");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(handlers.onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  test("explains empty filtered results and offers recovery", () => {
    renderReviews({ comments: [], total: 0, search: "missing" });
    expect(screen.getByText("No matching reviews")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(handlers.onSearchChange).toHaveBeenCalledWith("");
  });
});
