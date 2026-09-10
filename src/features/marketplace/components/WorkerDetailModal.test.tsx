import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WorkerDetailModal from "./WorkerDetailModal";

const worker = {
  actionType: "book",
  description: "Apartment cleaning service",
  location: "Malolos, Bulacan",
  name: "Maria Teresa Cruz",
  photo: "https://example.com/maria.jpg",
  pricingType: "fixed",
  rateBasis: "per-project",
  rating: 4.67,
  reviews: 3,
  title: "Apartment Cleaning & Organization",
};

describe("WorkerDetailModal", () => {
  it("keeps the profile photo compact until the avatar is selected", async () => {
    const user = userEvent.setup();

    render(<WorkerDetailModal isOpen worker={worker} onClose={vi.fn()} onBookNow={vi.fn()} />);

    expect(screen.queryByAltText("Maria Teresa Cruz work sample")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Maria Teresa Cruz profile photo" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Maria Teresa Cruz profile photo" }));
    expect(screen.getByRole("dialog", { name: "Maria Teresa Cruz profile photo" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Maria Teresa Cruz profile photo" })).not.toBeInTheDocument();
  });

  it("shows actual service portfolio images without using the avatar as a fallback", () => {
    render(
      <WorkerDetailModal
        isOpen
        worker={{ ...worker, gallery: ["https://example.com/service-work.jpg"] }}
        onClose={vi.fn()}
        onBookNow={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Maria Teresa Cruz work sample")).toHaveAttribute(
      "src",
      "https://example.com/service-work.jpg",
    );
  });

  it("preserves the message and booking actions", async () => {
    const user = userEvent.setup();
    const onBookNow = vi.fn();
    render(<WorkerDetailModal isOpen worker={worker} onClose={vi.fn()} onBookNow={onBookNow} />);

    await user.click(screen.getByRole("button", { name: "Message Maria Teresa Cruz" }));
    expect(onBookNow).toHaveBeenCalledWith(expect.objectContaining({ actionType: "inquire" }));

    await user.click(screen.getByRole("button", { name: "Book now" }));
    expect(onBookNow).toHaveBeenCalledWith(worker);
  });
});
