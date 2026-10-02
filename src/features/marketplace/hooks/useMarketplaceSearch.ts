import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export function useMarketplaceSearch(onSearchChange?: (event: { target: { value: string } }) => void) {
  const [params, setParams] = useSearchParams();
  const latestParams = useRef(params);
  useEffect(() => { latestParams.current = params; }, [params]);
  const searchQuery = params.get("q") || "";
  const locationQuery = params.get("location") || "";
  const activeCategory = params.get("category") || "All";
  const selectedDistrict = params.get("district") || "All Districts";
  const requestedSort = params.get("sort") || "recommended";
  const sortMode = ["recommended", "rating", "price-low", "newest"].includes(requestedSort) ? requestedSort : "recommended";
  const update = (key: "q" | "location" | "category" | "district" | "sort", value: string) => {
    const next = new URLSearchParams(latestParams.current);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    latestParams.current = next;
    setParams(next, { replace: true });
  };
  return {
    searchQuery, locationQuery, activeCategory, selectedDistrict, sortMode,
    setActiveCategory: (value: string) => update("category", value === "All" ? "" : value),
    setSelectedDistrict: (value: string) => update("district", value === "All Districts" ? "" : value),
    setSortMode: (value: string) => update("sort", value === "recommended" ? "" : value),
    hasActiveFilters: Boolean(searchQuery.trim() || locationQuery.trim()) || activeCategory !== "All" || selectedDistrict !== "All Districts" || sortMode !== "recommended",
    clearFilters: () => {
      const next = new URLSearchParams(latestParams.current);
      for (const key of ["q", "location", "category", "district", "sort", "page"]) next.delete(key);
      latestParams.current = next;
      setParams(next, { replace: true });
      onSearchChange?.({ target: { value: "" } });
    },
    handleSearchChange: (event: { target: { value: string } }) => { update("q", event.target.value); onSearchChange?.(event); },
    handleLocationChange: (event: { target: { value: string } }) => update("location", event.target.value),
    clearSearch: () => {
      const next = new URLSearchParams(latestParams.current);
      next.delete("q"); next.delete("location"); next.delete("page");
      latestParams.current = next;
      setParams(next, { replace: true });
      onSearchChange?.({ target: { value: "" } });
    },
  };
}
