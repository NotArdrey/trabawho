import { describe, expect, it } from "vitest";
import { paginateBookings } from "./bookingPagination";

describe("booking pagination", () => {
  const bookings = Array.from({ length: 28 }, (_, index) => index + 1);

  it("shows eight bookings and the visible range", () => {
    expect(paginateBookings(bookings, "2")).toMatchObject({ page: 2, pageCount: 4, first: 9, last: 16, items: bookings.slice(8, 16) });
  });

  it("clamps invalid or stale pages after filtering", () => {
    expect(paginateBookings(bookings.slice(0, 3), "4")).toMatchObject({ page: 1, pageCount: 1, first: 1, last: 3 });
    expect(paginateBookings(bookings, "-2").page).toBe(1);
    expect(paginateBookings(bookings, "not-a-page").page).toBe(1);
  });
});
