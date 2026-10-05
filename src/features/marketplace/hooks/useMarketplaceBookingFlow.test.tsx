import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentSelectionDetails } from "@/features/bookings";
import { useMarketplaceBookingFlow } from "./useMarketplaceBookingFlow";

const api = vi.hoisted(() => ({ startServiceConversation: vi.fn(), createPayMongoCheckout: vi.fn(), redirectToPayMongo: vi.fn() }));
vi.mock("@/features/bookings", () => api);
const provider = { id: 1, name: "Provider", bookingMode: "with-slots", projectRate: 1200, rawService: { id: 1, seller_id: "seller" } };
const options = () => ({ isPublic: false, services: [provider], schedulesByProvider: {
  "1": { dayBlocks: { "2026-10-06": [{ id: 2, startTime: "09:00", endTime: "10:00", rawSlot: { id: 2 } }] } },
}, refreshSchedules: vi.fn(), onOpenChatPage: vi.fn() });

describe("marketplace booking flow", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T09:00:00Z")); api.startServiceConversation.mockResolvedValue({ id: "conversation" }); });
  afterEach(() => vi.useRealTimers());

  it("opens Message directly in chat without opening a booking or payment dialog", async () => {
    const opts = options();
    const { result } = renderHook(() => useMarketplaceBookingFlow(opts));
    await act(async () => {
      result.current.handleViewProfile(provider);
      result.current.handleBookNow({ ...provider, actionType: "inquire" });
      await Promise.resolve();
    });
    expect(opts.onOpenChatPage).toHaveBeenCalledWith("conversation");
    expect(result.current.isBookingCalendarOpen).toBe(false);
    expect(result.current.isPaymentModalOpen).toBe(false);
    expect(result.current.isWorkerModalOpen).toBe(false);
    expect(api.createPayMongoCheckout).not.toHaveBeenCalled();
  });

  it("opens the calendar before payment and does not create a reservation when Book now is clicked", () => {
    const opts = options();
    const { result } = renderHook(() => useMarketplaceBookingFlow(opts));
    act(() => { result.current.handleBookNow(provider); });
    expect(opts.refreshSchedules).toHaveBeenCalledOnce();
    expect(result.current.isBookingCalendarOpen).toBe(true);
    expect(result.current.isPaymentModalOpen).toBe(false);
    expect(api.createPayMongoCheckout).not.toHaveBeenCalled();
    act(() => { result.current.handleConfirmBooking({ workerId: 1, date: "2026-10-06", dayKey: "Tue", blockId: 2 }); });
    expect(result.current.isPaymentModalOpen).toBe(true);
    expect(result.current.pendingBooking?.selectedSlot.slotId).toBe(2);
    expect(api.createPayMongoCheckout).not.toHaveBeenCalled();
  });

  it("does not advance a stale same-day selection to payment", () => {
    const opts = options();
    const { result } = renderHook(() => useMarketplaceBookingFlow(opts));
    act(() => { result.current.handleBookNow(provider); });
    act(() => { result.current.handleConfirmBooking({ workerId: 1, date: "2026-10-05", dayKey: "Mon", blockId: 2 }); });
    expect(result.current.isPaymentModalOpen).toBe(false);
    expect(result.current.bookingError).toMatch(/tomorrow onward/i);
    expect(opts.refreshSchedules).toHaveBeenCalledTimes(2);
  });

  it("returns to refreshed times when another client claimed the slot at checkout", async () => {
    api.createPayMongoCheckout.mockRejectedValueOnce(new Error("This provider already has a booking at that time"));
    const opts = options();
    const { result } = renderHook(() => useMarketplaceBookingFlow(opts));
    act(() => {
      result.current.handleBookNow(provider);
      result.current.handleConfirmBooking({ workerId: 1, date: "2026-10-06", dayKey: "Tue", blockId: 2 });
    });
    await act(async () => { await result.current.handleSelectPayment("paymongo-card", { paymentPlan: "full" } as PaymentSelectionDetails); });
    expect(result.current.isPaymentModalOpen).toBe(false);
    expect(result.current.isBookingCalendarOpen).toBe(true);
    expect(result.current.bookingError).toMatch(/no longer available/i);
    expect(opts.refreshSchedules).toHaveBeenCalledTimes(2);
  });

  it("routes request-only services to chat to agree on scope and price", async () => {
    const { result } = renderHook(() => useMarketplaceBookingFlow(options()));
    await act(async () => { result.current.handleBookNow({ ...provider, bookingMode: "calendar-only" }); await Promise.resolve(); });
    expect(api.startServiceConversation).toHaveBeenCalledOnce();
    expect(result.current.isBookingCalendarOpen).toBe(false);
  });
});
