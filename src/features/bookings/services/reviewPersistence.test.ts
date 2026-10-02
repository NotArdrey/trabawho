import { persistBookingReview } from "./reviewPersistence";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }));

function query(result: unknown) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
  return chain;
}
describe("completed booking reviews", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "buyer-1" } }, error: null });
  });
  function prepare(buyerId = "buyer-1", status = "completed", existing: unknown = null, writeError: unknown = null) {
    const booking = query({ data: { id: "booking-1", buyer_id: buyerId, seller_id: "authoritative-seller", status }, error: null });
    const read = query({ data: existing, error: null });
    const write = query({ data: writeError ? null : { id: 1 }, error: writeError });
    mocks.insert.mockReturnValue(write); mocks.update.mockReturnValue(write);
    mocks.from.mockReturnValueOnce(booking).mockReturnValueOnce(read).mockReturnValueOnce({ insert: mocks.insert, update: mocks.update });
  }
  it("saves with the stored booking seller instead of a cached worker identity", async () => {
    prepare();
    await expect(persistBookingReview("booking-1", 5, " Good service ", null)).resolves.toMatchObject({ rating: 5, review: "Good service", canRate: false });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ booking_id: "booking-1", seller_id: "authoritative-seller", reviewer_id: "buyer-1", body: "Good service" }));
  });
  it("rejects a changed session before uploading or saving", async () => {
    prepare("other-buyer");
    await expect(persistBookingReview("booking-1", 5, "", null)).rejects.toThrow("Only the client");
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects an uncompleted booking before saving", async () => {
    prepare("buyer-1", "confirmed");
    await expect(persistBookingReview("booking-1", 5, "", null)).rejects.toThrow("Confirm service completion");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("reuses an existing review on retry", async () => {
    prepare("buyer-1", "completed", { id: 1, image_url: "https://example.test/photo.png" });
    await expect(persistBookingReview("booking-1", 4, "Thanks", null)).resolves.toMatchObject({ reviewImageUrl: "https://example.test/photo.png" });
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("keeps server diagnostics out of submission feedback", async () => {
    prepare("buyer-1", "completed", null, { code: "42501", message: "Private diagnostic" });
    await expect(persistBookingReview("booking-1", 5, "", null)).rejects.toThrow("Sign in again and retry");
  });
});
