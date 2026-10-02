import { useCallback, useEffect, useRef, useState } from "react";

export function useAdminResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setIsLoading(true);
    setError("");
    try {
      const result = await load();
      if (id === request.current) setData(result);
    } catch {
      if (id === request.current) setError("This activity could not be loaded. Check your connection, confirm admin access, and retry.");
    } finally {
      if (id === request.current) setIsLoading(false);
    }
  }, [load]);
  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => {
    let active = true;
    const reconcile = () => { if (active && document.visibilityState !== "hidden" && navigator.onLine) void refresh(); };
    queueMicrotask(reconcile);
    const interval = window.setInterval(reconcile, 30_000);
    window.addEventListener("focus", reconcile);
    window.addEventListener("online", reconcile);
    return () => { active = false; invalidate(); window.clearInterval(interval); window.removeEventListener("focus", reconcile); window.removeEventListener("online", reconcile); };
  }, [refresh, invalidate]);
  return { data, isLoading, error, refresh };
}
