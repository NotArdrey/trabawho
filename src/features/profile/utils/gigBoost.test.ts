import { describe, expect, it } from "vitest";
import { buildBoostDraft } from "./gigBoost";

describe("gig boost settings", () => {
  it("charges the entire entered budget once", () => expect(buildBoostDraft("12", "Cleaning", "7", "250")).toMatchObject({ days: 7, amount: 250 }));
  it.each([["0", "250"], ["7.5", "250"], ["366", "250"], ["7", "0"], ["7", "250.001"]])("rejects invalid duration %s or budget %s", (days, budget) => expect(() => buildBoostDraft("12", "Cleaning", days, budget)).toThrow());
});
