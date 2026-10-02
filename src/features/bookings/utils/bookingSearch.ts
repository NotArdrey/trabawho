export interface SearchableBooking {
  id?: string | number;
  clientName?: string;
  workerName?: string;
  serviceType?: string;
  description?: string;
  status?: string;
  paymentReference?: string;
  transactionId?: string;
  requestDate?: string;
  selectedSlot?: { date?: string } | null;
}

export function matchesBookingSearch(booking: SearchableBooking, query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = [booking.id, booking.clientName, booking.workerName, booking.serviceType, booking.description,
    booking.status, booking.paymentReference, booking.transactionId, booking.requestDate, booking.selectedSlot?.date].filter(Boolean).join(" ").toLocaleLowerCase();
  return words.every((word) => text.includes(word));
}
