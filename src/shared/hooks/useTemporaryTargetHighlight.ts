import { useEffect, useState } from "react";

const HIGHLIGHT_MS = 8_000;

export function useTemporaryTargetHighlight(
  targetId: string | null,
  visible: boolean,
  navigationKey?: string,
  block: ScrollLogicalPosition = "center",
) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId || !visible) return;
    let target: HTMLElement | null = null;
    const frame = window.requestAnimationFrame(() => {
      target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView?.({ block, behavior: "auto" });
      target.focus({ preventScroll: true });
      setHighlightedId(targetId);
    });
    const timeout = window.setTimeout(() => {
      setHighlightedId(null);
      if (target && document.activeElement === target) target.blur();
    }, HIGHLIGHT_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      if (target && document.activeElement === target) target.blur();
    };
  }, [targetId, visible, navigationKey, block]);

  return highlightedId === targetId;
}
