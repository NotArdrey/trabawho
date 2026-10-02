import { useSearchParams } from "react-router-dom";

export function useMarketplaceSearch(onSearchChange?: (event: { target: { value: string } }) => void) {
  const [params, setParams] = useSearchParams();
  const searchQuery = params.get("q") || "";
  const locationQuery = params.get("location") || "";
  const update = (key: "q" | "location", value: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value); else next.delete(key);
      next.delete("page");
      return next;
    }, { replace: true });
  };
  return {
    searchQuery, locationQuery,
    handleSearchChange: (event: { target: { value: string } }) => { update("q", event.target.value); onSearchChange?.(event); },
    handleLocationChange: (event: { target: { value: string } }) => update("location", event.target.value),
    clearSearch: () => {
      setParams((previous) => { const next = new URLSearchParams(previous); next.delete("q"); next.delete("location"); next.delete("page"); return next; }, { replace: true });
      onSearchChange?.({ target: { value: "" } });
    },
  };
}
