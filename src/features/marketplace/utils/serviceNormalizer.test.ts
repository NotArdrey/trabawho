import { describe, expect, it } from "vitest";
import { getDisplayServiceType, normalizeServiceRecord } from "./serviceNormalizer";

describe("marketplace gig identity", () => {
  const sellers = { user_id: "provider-1", display_name: "Jose Ramos", search_meta: { service_type: "Provider category" } };
  it("keeps two gigs from one provider distinct even when profile and metadata labels are stale", () => {
    const first = normalizeServiceRecord({ id: 101, title: "Home maintenance", base_price: 10000, description: "General maintenance", sellers });
    const second = normalizeServiceRecord({ id: 97, title: "Appliance Installation & Repair", base_price: 850,
      description: "Installs appliances", metadata: { service_type: "Old title" }, sellers });
    expect(first.name).toBe(second.name);
    expect(getDisplayServiceType(first)).toBe("Home maintenance");
    expect(getDisplayServiceType(second)).toBe("Appliance Installation & Repair");
    expect(first.id).not.toBe(second.id);
    expect(second.description).toBe("Installs appliances");
  });
  it("uses service metadata before provider categories for legacy gigs without titles", () => {
    expect(normalizeServiceRecord({ metadata: { service_type: "Electrical repair" }, sellers }).serviceType).toBe("Electrical repair");
    expect(normalizeServiceRecord({ sellers }).serviceType).toBe("Provider category");
  });
});
