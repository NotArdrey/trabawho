import { useEffect, useState } from "react";

/** Local Vite and explicitly enabled test deployments can offer one-click sandbox checkout. */
export function useSandboxCheckoutAvailable(): boolean {
  const [available, setAvailable] = useState(import.meta.env.DEV);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const controller = new AbortController();
    void fetch("/__trabawho_paymongo_sandbox_ready", { cache: "no-store", signal: controller.signal })
      .then((response) => { if (response.ok) setAvailable(true); })
      .catch(() => { /* The regular hosted checkout stays available. */ });
    return () => controller.abort();
  }, []);
  return available;
}
