import { describe, expect, it } from "vitest";

import { getPaymentLabel } from "./generateProviderPortfolio";

describe("getPaymentLabel", () => {
  it("shows a configured GCash contact", () => {
    expect(getPaymentLabel("09123456789")).toBe("GCash 09123456789");
  });

  it("does not export placeholder account details", () => {
    expect(getPaymentLabel("09XXXXXXXXX")).toBe("Coordinate through TrabaWho");
    expect(getPaymentLabel()).toBe("Coordinate through TrabaWho");
  });
});
