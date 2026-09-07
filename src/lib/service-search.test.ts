import { describe, expect, it } from "vitest";

import {
  buildServicesUrl,
  createServiceSearchParams,
  parseServiceSearchParams,
} from "./service-search";

describe("service search URL", () => {
  it("trims and encodes service and location values", () => {
    expect(
      buildServicesUrl({ query: "  aircon cleaning ", location: " Quezon City " }),
    ).toBe("/services?q=aircon+cleaning&location=Quezon+City");
  });

  it("opens all services when fields are empty", () => {
    expect(buildServicesUrl({ query: " ", location: "" })).toBe("/services");
  });

  it("parses only supported search parameters", () => {
    expect(parseServiceSearchParams("?q=Tutor&location=Malolos&sort=rating")).toEqual({
      query: "Tutor",
      location: "Malolos",
    });
  });

  it("omits empty values when creating parameters", () => {
    expect(createServiceSearchParams({ query: "Cleaning", location: "  " }).toString()).toBe(
      "q=Cleaning",
    );
  });
});
