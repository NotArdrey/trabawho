import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import { DataPagination } from "./data-pagination";

describe("DataPagination", () => {
  it("uses page-number buttons, announces the current page, and disables boundary controls", () => {
    const onPageChange = vi.fn();
    render(<DataPagination label="Account pages" page={1} pageCount={3} onPageChange={onPageChange} />);
    const pages = screen.getByRole("navigation", { name: "Account pages" });
    expect(within(pages).getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(within(pages).getByRole("button", { name: "Page 1, current page" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(pages).getByRole("button", { name: "Page 3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(within(pages).getByRole("status")).toHaveTextContent("Page 1 of 3");
  });

  it("keeps long page lists compact", () => {
    render(<DataPagination label="Case pages" page={5} pageCount={20} onPageChange={vi.fn()} />);
    const pages = screen.getByRole("navigation", { name: "Case pages" });
    expect(within(pages).getAllByText("More pages")).toHaveLength(2);
    expect(within(pages).getByRole("button", { name: "Page 5, current page" })).toBeVisible();
  });
});
