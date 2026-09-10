import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchFilterBar } from "./search-filter-bar";

const options = [
  { value: "all", label: "All", count: 4 },
  { value: "action", label: "Action needed", count: 1 },
  { value: "scheduled", label: "Scheduled", count: 2 },
  { value: "completed", label: "Completed", count: 1 },
];

describe("SearchFilterBar", () => {
  it("supports arrow-key navigation across filters", async () => {
    const user = userEvent.setup();
    const onActiveValueChange = vi.fn();
    render(<SearchFilterBar activeValue="all" options={options} onActiveValueChange={onActiveValueChange} onSearchValueChange={vi.fn()} searchLabel="Search bookings" searchValue="" />);

    const allButton = screen.getByRole("button", { name: "All, 4" });
    allButton.focus();
    await user.keyboard("{ArrowRight}");
    expect(onActiveValueChange).toHaveBeenCalledWith("action");
    expect(screen.getByRole("button", { name: "Action needed, 1" })).toHaveFocus();
  });

  it("supports grab dragging without activating a filter", () => {
    const onActiveValueChange = vi.fn();
    render(<SearchFilterBar activeValue="all" options={options} onActiveValueChange={onActiveValueChange} onSearchValueChange={vi.fn()} searchLabel="Search bookings" searchValue="" />);
    const rail = screen.getByLabelText("Filter results");
    Object.defineProperty(rail, "scrollLeft", { configurable: true, value: 100, writable: true });

    fireEvent.pointerDown(rail, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100 });
    fireEvent.pointerMove(rail, { pointerId: 1, pointerType: "mouse", clientX: 40 });
    fireEvent.pointerUp(rail, { pointerId: 1, pointerType: "mouse", clientX: 40 });

    expect(rail.scrollLeft).toBe(160);
    expect(onActiveValueChange).not.toHaveBeenCalled();
  });
});
