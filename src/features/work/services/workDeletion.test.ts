import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteWorkService, deleteWorkSlot } from "./workDeletion";
const { from, query } = vi.hoisted(() => ({ from: vi.fn(), query: { select: vi.fn(), eq: vi.fn(), update: vi.fn(), delete: vi.fn(), single: vi.fn() } }));
vi.mock("@/integrations/supabase", () => ({ supabase: { from } }));
describe("work deletion persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    from.mockReturnValue(query);
    for (const method of [query.select, query.eq, query.update, query.delete]) method.mockReturnValue(query);
  });
  it("removes a listing without deleting the service referenced by existing bookings", async () => {
    query.single.mockResolvedValueOnce({ data: { metadata: { booking_mode: "with-slots" } }, error: null }).mockResolvedValueOnce({ data: { id: 7 }, error: null });
    await deleteWorkService(7, "worker-1");
    expect(query.update).toHaveBeenCalledWith({ active: false, metadata: { booking_mode: "with-slots", deleted_from_work: true } });
    expect(query.eq).toHaveBeenCalledWith("seller_id", "worker-1");
    expect(query.delete).not.toHaveBeenCalled();
  });
  it("does not report success when no availability row was deleted", async () => {
    query.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    await expect(deleteWorkSlot(8, "worker-1")).rejects.toThrow("Unable to delete this availability");
    expect(query.eq).toHaveBeenCalledWith("seller_id", "worker-1");
    expect(query.eq).toHaveBeenCalledWith("id", 8);
  });
});
