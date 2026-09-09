import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MarketplaceFilterPanel } from "./MarketplaceFilterPanel";

const defaultProps = {
  activeCategory: "All",
  categories: [
    { label: "All", count: 10 },
    { label: "Technician", count: 2 },
  ],
  districts: ["All Districts", "San Roque"],
  hasActiveFilters: false,
  isOpen: true,
  isPublic: false,
  locationQuery: "",
  onCategoryChange: vi.fn(),
  onClear: vi.fn(),
  onClose: vi.fn(),
  onDistrictChange: vi.fn(),
  onLocationChange: vi.fn(),
  selectedDistrict: "All Districts",
};

describe("MarketplaceFilterPanel", () => {
  it("exposes filter selection and service counts accessibly", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();

    render(<MarketplaceFilterPanel {...defaultProps} onCategoryChange={onCategoryChange} />);

    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("All");
    expect(screen.getByLabelText("10 services")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Technician/i }));
    expect(onCategoryChange).toHaveBeenCalledWith("Technician");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });

  it("keeps close and reset actions keyboard operable", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onClose = vi.fn();

    render(
      <MarketplaceFilterPanel
        {...defaultProps}
        activeCategory="Technician"
        hasActiveFilters
        onClear={onClear}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });
});
