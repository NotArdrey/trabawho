import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmBookingCompletion,
  fetchBookingById,
  markBookingDelivered,
} from "@/features/bookings/services/bookingService";
import { lifecycleOperationId, performBookingLifecycleAction } from "./bookingLifecycle";

vi.mock("@/features/bookings/services/bookingService", () => ({
  confirmBookingCompletion: vi.fn(),
  fetchBookingById: vi.fn(),
  markBookingDelivered: vi.fn(),
}));

const current = { id: "booking-1", scheduleVersion: 3, deliveryStatus: "not_delivered" };
const delivered = { ...current, deliveryStatus: "seller_claimed" };

describe("booking lifecycle actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBookingById).mockResolvedValue(current as never);
  });

  it("uses a stable operation ID for the same booking schedule", () => {
    expect(lifecycleOperationId("deliver", current)).toBe("booking-deliver-booking-1-schedule-3");
    expect(lifecycleOperationId("deliver", current)).toBe(lifecycleOperationId("deliver", current));
    expect(lifecycleOperationId("deliver", { ...current, scheduleVersion: 4 })).not.toBe(lifecycleOperationId("deliver", current));
  });

  it("refreshes authoritative state after provider delivery", async () => {
    vi.mocked(fetchBookingById).mockResolvedValueOnce(current as never).mockResolvedValueOnce(delivered as never);

    await expect(performBookingLifecycleAction("deliver", current.id)).resolves.toEqual(delivered);
    expect(markBookingDelivered).toHaveBeenCalledWith(current.id, {
      idempotencyKey: "booking-deliver-booking-1-schedule-3",
    });
    expect(fetchBookingById).toHaveBeenCalledTimes(2);
  });

  it("reuses the same operation ID when completion is retried", async () => {
    vi.mocked(confirmBookingCompletion).mockRejectedValueOnce(new Error("Network unavailable"));

    await expect(performBookingLifecycleAction("complete", current.id)).rejects.toThrow("Network unavailable");
    await performBookingLifecycleAction("complete", current.id);

    expect(confirmBookingCompletion).toHaveBeenCalledTimes(2);
    expect(vi.mocked(confirmBookingCompletion).mock.calls[0]?.[1]).toEqual(
      vi.mocked(confirmBookingCompletion).mock.calls[1]?.[1],
    );
  });
});
