import { mapSellerRowToUiProfile, mapServiceRowToWorkerService, withWorkerPreferences } from "./workerService";
import type { ServiceRow } from "../types/worker-profile";

const row: ServiceRow = { id: 7, seller_id: "worker-1", title: "Repair", short_description: "Appliance repair", description: "Appliance repair",
  base_price: 850, price_type: "fixed", duration_minutes: 45, active: true, category_id: null, currency: "PHP", slug: "repair", created_at: "", updated_at: "", metadata: {} };

describe("worker payment preference mapping", () => {
  it("keeps current preferences when a realtime listing update carries an older fallback profile", () => {
    const preferences = { paymentAdvance: true, paymentAfterService: false, gcashNumber: "09123456789" };
    const realtimeListing = mapServiceRowToWorkerService(row, null, { paymentAdvance: false, paymentAfterService: true, gcashNumber: "" });
    expect(withWorkerPreferences(realtimeListing, preferences)).toMatchObject({ ...preferences, raw: row });
  });
  it("keeps saved preferences on every listing using the normalized worker profile", () => {
    const preferences = { paymentAdvance: true, paymentAfterService: false, afterServicePaymentType: "gcash-only" as const, gcashNumber: "09123456789" };
    const provider = mapSellerRowToUiProfile({ display_name: "Provider", search_meta: {} }, preferences);
    for (const service of [row, { ...row, id: 8, title: "Computer repair" }]) {
      expect(mapServiceRowToWorkerService(service, { display_name: "Provider" }, provider)).toMatchObject(preferences);
    }
  });

  it("preserves an explicitly cleared number and false values instead of restoring older preferences", () => {
    const saved = { paymentAdvance: false, paymentAfterService: true, afterServicePaymentType: "cash-only" as const, gcashNumber: "" };
    const older = { paymentAdvance: true, gcashNumber: "09123456789" };
    const provider = mapSellerRowToUiProfile(null, saved, older);
    expect(mapServiceRowToWorkerService(row, null, provider)).toMatchObject(saved);
  });
});
