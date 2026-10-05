import { fireEvent, render, screen, within } from "@testing-library/react";
import { DeleteReviewConfirmation } from "./DeleteReviewConfirmation";
import type { AdminComment } from "../types";

const review: AdminComment = { id: 7, worker: "Ana Provider", client: "Ben Client", rating: 5,
  comment: "Careful repair", status: "published" };

describe("review deletion confirmation", () => {
  it("names the review and does not delete when cancelled", () => {
    const cancel = vi.fn();
    const confirm = vi.fn();
    render(<DeleteReviewConfirmation review={review} saving={false} error="" onCancel={cancel} onConfirm={confirm} />);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Review by Ben Client for Ana Provider");
    expect(dialog).toHaveTextContent("Careful repair");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("confirms the selected review and keeps errors in the shared modal", () => {
    const confirm = vi.fn();
    render(<DeleteReviewConfirmation review={review} saving={false} error="Could not delete this review." onCancel={vi.fn()} onConfirm={confirm} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not delete this review.");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete review" }));
    expect(confirm).toHaveBeenCalledExactlyOnceWith(7);
  });
});
