import { useEffect, useState } from "react";

const HIGHLIGHT_MS = 8_000;

export function useBookingFocus(bookingId: string | null, visible: boolean) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !visible) return;
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(`booking-card-${bookingId}`);
      if (!card) return;
      card.scrollIntoView?.({ block: "center", behavior: "auto" });
      card.focus({ preventScroll: true });
      setHighlightedId(bookingId);
    });
    const timeout = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [bookingId, visible]);

  return highlightedId === bookingId ? highlightedId : null;
}
