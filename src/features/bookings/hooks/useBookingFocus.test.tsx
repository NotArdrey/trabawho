import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useBookingFocus } from "./useBookingFocus";

afterEach(() => { vi.useRealTimers(); document.getElementById("booking-card-job-1")?.remove(); });

it("focuses the linked booking and removes its temporary highlight", () => {
  vi.useFakeTimers();
  const card = document.createElement("article");
  card.id = "booking-card-job-1";
  card.tabIndex = -1;
  const scrollIntoView = vi.fn();
  card.scrollIntoView = scrollIntoView;
  document.body.append(card);
  const { result } = renderHook(() => useBookingFocus("job-1", true));
  act(() => { vi.advanceTimersByTime(20); });
  expect(result.current).toBe("job-1");
  expect(card).toHaveFocus();
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  act(() => { vi.advanceTimersByTime(8_000); });
  expect(result.current).toBeNull();
  expect(card).not.toHaveFocus();
});

it("does not remove focus after the user moves to another control", () => {
  vi.useFakeTimers();
  const card = document.createElement("article");
  card.id = "booking-card-job-1";
  card.tabIndex = -1;
  card.scrollIntoView = vi.fn();
  const button = document.createElement("button");
  document.body.append(card, button);
  renderHook(() => useBookingFocus("job-1", true));
  act(() => { vi.advanceTimersByTime(20); });
  button.focus();
  act(() => { vi.advanceTimersByTime(8_000); });
  expect(button).toHaveFocus();
  button.remove();
});
