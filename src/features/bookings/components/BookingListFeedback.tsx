import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BookingListFeedback({ error, onRetry, loading }: {
  error: string; onRetry: () => Promise<unknown>; loading: boolean;
}) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
    <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
    <p className="min-w-0 flex-1">{error}</p>
    <Button type="button" variant="outline" disabled={loading} onClick={() => { void onRetry(); }}>
      <RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} />
      {loading ? "Retrying…" : "Retry loading bookings"}
    </Button>
  </div>;
}
