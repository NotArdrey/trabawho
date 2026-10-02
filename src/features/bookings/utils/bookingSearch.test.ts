import { matchesBookingSearch } from "./bookingSearch";

describe("booking search", () => {
  const booking = { id: "booking-reference-123", workerName: "Arnold Castillo", clientName: "Sofia Cruz", serviceType: "Plumbing Leak Repair", paymentReference: "PAY-567" };
  it.each(["Sofia", "reference-123", " PAY-567 ", "castillo plumbing", "SOFIA REPAIR"])("finds names, references and words for %s", (search) => {
    expect(matchesBookingSearch(booking, search)).toBe(true);
  });
  it("returns no match for unrelated words", () => { expect(matchesBookingSearch(booking, "cleaning")).toBe(false); });
});
