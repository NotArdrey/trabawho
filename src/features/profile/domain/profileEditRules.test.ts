import { describe, expect, it } from "vitest";
import { assertEditableProfileFields } from "./profileEditRules";

describe("profile edit rules", () => {
  it("allows contact and location changes", () => {
    expect(() => assertEditableProfileFields({ phoneNumber: "09171234567", address: "New address" })).not.toThrow();
  });

  it.each(["firstName", "middleName", "lastName", "fullName"])("rejects changes to %s", (field) => {
    expect(() => assertEditableProfileFields({ [field]: "Changed" })).toThrow(/identity review/);
  });
});
