import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LandingHero from "./LandingHero";

describe("LandingHero", () => {
  it("submits accessible service and location fields", () => {
    const onSearch = vi.fn();
    render(<LandingHero onSearch={onSearch} />);

    fireEvent.change(screen.getByLabelText("What service do you need?"), {
      target: { value: "Aircon cleaning" },
    });
    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Malolos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledWith({
      query: "Aircon cleaning",
      location: "Malolos",
    });
  });

  it("allows an empty search to browse every service", () => {
    const onSearch = vi.fn();
    render(<LandingHero onSearch={onSearch} />);

    fireEvent.submit(screen.getByRole("search"));
    expect(onSearch).toHaveBeenCalledWith({ query: "", location: "" });
  });
});
