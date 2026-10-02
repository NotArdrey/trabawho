import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MarketplaceSearchToolbar } from "./MarketplaceSearchToolbar";

describe("MarketplaceSearchToolbar", () => {
  it("keeps search, sort, and mobile filters independently operable", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onToggleFilters = vi.fn();

    render(<MarketplaceSearchToolbar searchQuery="" sortMode="recommended" filtersOpen={false}
      onSearchChange={onSearchChange} onSortChange={onSortChange} onToggleFilters={onToggleFilters} />);

    await user.type(screen.getByRole("searchbox", { name: "Search services and providers" }), "r");
    expect(onSearchChange).toHaveBeenCalledWith("r");

    expect(screen.getByRole("combobox", { name: "Sort services" })).toBeVisible();
    expect(onSortChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(onToggleFilters).toHaveBeenCalledOnce();
  });
});
