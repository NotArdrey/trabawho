import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWorkerProfileServices } from "./workerService";
import type { ServiceRow } from "../types/worker-profile";
const { from, query, profile, bundle } = vi.hoisted(() => ({ from: vi.fn(), query: { select: vi.fn(), eq: vi.fn(), order: vi.fn(), maybeSingle: vi.fn() }, profile: vi.fn(), bundle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/shared/services/authService", () => ({ fetchSellerProfile: profile, fetchUserProfileBundle: bundle, createSellerService: vi.fn(), syncWorkerSetup: vi.fn() }));
const row: ServiceRow = { id: 7, seller_id: "worker-1", title: "Repair", short_description: "", description: "", base_price: 800, price_type: "fixed", duration_minutes: 60, active: false, category_id: null, currency: "PHP", slug: "repair", created_at: "", updated_at: "", metadata: { deleted_from_work: true } };
describe("deleted worker listings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    from.mockReturnValue(query);
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [row, { ...row, id: 8, active: true, metadata: {} }], error: null });
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    profile.mockResolvedValue({ user_id: "worker-1", display_name: "Provider" });
    bundle.mockResolvedValue(null);
  });
  it("keeps deleted listings out of My Work while retaining evidence for setup repair", async () => {
    const result = await loadWorkerProfileServices({ userId: "worker-1" });
    expect(result.workerServices.map((service) => service.raw.id)).toEqual([8]);
    expect(result.sellerDbServices.map((service) => service.id)).toEqual([7, 8]);
  });
  it("retains a deleted last service so reloading cannot silently recreate it", async () => {
    query.order.mockResolvedValue({ data: [row], error: null });
    const result = await loadWorkerProfileServices({ userId: "worker-1" });
    expect(result.workerServices).toEqual([]);
    expect(result.sellerDbServices).toHaveLength(1);
  });
});
