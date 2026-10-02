import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useMarketplaceSearch } from "./useMarketplaceSearch";

describe("marketplace URL search", () => {
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
