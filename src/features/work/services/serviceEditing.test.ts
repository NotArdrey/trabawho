import { saveServiceEdit } from "./serviceEditing";
import { serviceDraftToProfileUpdate, serviceProfileToDraft, type ServiceRow } from "../utils/serviceDraft";

const mocks = vi.hoisted(() => ({ from: vi.fn<(table: string) => unknown>() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

const row: ServiceRow = { id: 7, seller_id: "worker-1", title: "Repair", short_description: "Appliance repair", description: "Appliance repair",
  base_price: 850, price_type: "fixed", duration_minutes: 45, active: true, category_id: null, currency: "PHP", slug: "repair", created_at: "", updated_at: "",
  metadata: { availability_template: { Mon: [] }, ad_booster: { active: true }, unrelated: "keep" } };
const profile = { ...serviceDraftToProfileUpdate(serviceProfileToDraft({ raw: row })), paymentAdvance: true, paymentAfterService: false,
  afterServicePaymentType: "gcash-only" as const, gcashNumber: " 09123456789 " };

function query(response: { data: unknown; error: { code: string; message?: string } | null }) {
  const chain = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), single: vi.fn().mockResolvedValue(response) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.update.mockReturnValue(chain);
  return chain;
}

describe("service edit persistence", () => {
  beforeEach(() => mocks.from.mockReset());

  it("saves listing metadata and worker-owned payment preferences without writing to sellers", async () => {
    const read = query({ data: row, error: null });
    const listing = query({ data: { ...row, title: "Updated repair" }, error: null });
    const worker = query({ data: { user_id: row.seller_id }, error: null });
    mocks.from.mockReturnValueOnce(read).mockReturnValueOnce(listing).mockReturnValueOnce(worker);
    await expect(saveServiceEdit(row.id, row.seller_id, { ...profile, serviceType: "Updated repair" })).resolves.toMatchObject({ title: "Updated repair" });
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["services", "services", "worker_profiles"]);
    const payload: unknown = listing.update.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ metadata: { unrelated: "keep", availability_template: { Mon: [] }, ad_booster: { active: true } } });
    expect(listing.eq).toHaveBeenCalledWith("id", row.id);
    expect(listing.eq).toHaveBeenCalledWith("seller_id", row.seller_id);
    expect(worker.update).toHaveBeenCalledWith({ payment_advance: true, payment_after_service: false, after_service_payment_type: "gcash-only", gcash_number: "09123456789" });
    expect(worker.eq).toHaveBeenCalledWith("user_id", row.seller_id);
    expect(worker.select).toHaveBeenCalledWith("user_id");
    expect(worker.single).toHaveBeenCalledOnce();
  });

  it("does not save payment preferences when the listing write fails", async () => {
    mocks.from.mockReturnValueOnce(query({ data: row, error: null })).mockReturnValueOnce(query({ data: null, error: { code: "42501", message: "private database diagnostic" } }));
    await expect(saveServiceEdit(row.id, row.seller_id, profile)).rejects.toThrow("Sign in again");
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it.each(["42703", "PGRST116"])("reports a partial save when payment preferences fail (%s)", async (code) => {
    mocks.from.mockReturnValueOnce(query({ data: row, error: null })).mockReturnValueOnce(query({ data: row, error: null }))
      .mockReturnValueOnce(query({ data: null, error: { code, message: "private database diagnostic" } }));
    await expect(saveServiceEdit(row.id, row.seller_id, profile)).rejects.toThrow("Your listing was saved, but payment preferences could not be saved");
  });

  it("maps schema failures safely before mutating the listing", async () => {
    mocks.from.mockReturnValueOnce(query({ data: null, error: { code: "42703", message: "private database diagnostic" } }));
    await expect(saveServiceEdit(row.id, row.seller_id, profile)).rejects.toThrow("temporarily unavailable");
    expect(mocks.from).toHaveBeenCalledOnce();
  });
});
