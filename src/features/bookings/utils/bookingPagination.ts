export function paginateBookings<T>(bookings: T[], requestedPage: string | null, pageSize = 8) {
  const parsedPage = Number(requestedPage);
  const pageCount = Math.max(1, Math.ceil(bookings.length / pageSize));
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, pageCount) : 1;
  const first = bookings.length ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, bookings.length);
  return { page, pageCount, first, last, items: bookings.slice((page - 1) * pageSize, page * pageSize) };
}
