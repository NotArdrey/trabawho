import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useMarketplaceSearch } from "./useMarketplaceSearch";

describe("marketplace URL search", () => {
  it("preserves selections when multiple filters change before the route commits", () => {
    const { result } = renderHook(() => ({ ...useMarketplaceSearch(), location: useLocation() }), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/services?page=2"]}>{children}</MemoryRouter>,
    });
    act(() => {
      result.current.setActiveCategory("Cleaner");
      result.current.handleLocationChange({ target: { value: "Bulacan" } });
      result.current.setSortMode("rating");
    });
    expect(result.current.activeCategory).toBe("Cleaner");
    expect(result.current.locationQuery).toBe("Bulacan");
    expect(result.current.sortMode).toBe("rating");
  });
  it("restores all filters, resets pagination on changes, and clears them together", () => {
    const { result } = renderHook(() => ({ ...useMarketplaceSearch(), location: useLocation() }), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/services?q=pipe&location=Bulacan&category=Technician&district=Malolos&sort=rating&page=3&keep=yes"]}>{children}</MemoryRouter>,
    });
    expect(result.current.activeCategory).toBe("Technician");
    expect(result.current.selectedDistrict).toBe("Malolos");
    expect(result.current.sortMode).toBe("rating");
    act(() => result.current.setActiveCategory("Cleaner"));
    expect(new URLSearchParams(result.current.location.search).get("page")).toBeNull();
    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.location.search).toBe("?keep=yes");
    act(() => result.current.handleSearchChange({ target: { value: "pipe" } }));
    expect(result.current.hasActiveFilters).toBe(true);
  });
  it("restores a query, updates the URL, and clears search without losing other filters", () => {
    const onSearchChange = vi.fn();
    const { result } = renderHook(() => ({ ...useMarketplaceSearch(onSearchChange), location: useLocation() }), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/services?q=plumbing&location=Manila&page=3&category=repair"]}>{children}</MemoryRouter>,
    });
    expect(result.current.searchQuery).toBe("plumbing");
    act(() => result.current.handleSearchChange({ target: { value: "Arnold" } }));
    expect(result.current.searchQuery).toBe("Arnold");
    expect(new URLSearchParams(result.current.location.search).get("page")).toBeNull();
    expect(onSearchChange).toHaveBeenCalledWith({ target: { value: "Arnold" } });
    act(() => result.current.clearSearch());
    expect(result.current.searchQuery).toBe("");
    expect(result.current.locationQuery).toBe("");
    expect(new URLSearchParams(result.current.location.search).get("category")).toBe("repair");
  });
});
