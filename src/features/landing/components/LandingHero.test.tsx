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

  it("presents booking signals over the local hero image", () => {
    const { container } = render(<LandingHero onSearch={vi.fn()} />);

    expect(screen.getByRole("img", { name: /local appliance technician/i })).toHaveAttribute(
      "src",
      "/images/landing-services-hero-v2.jpg",
    );
    expect(screen.getAllByText("Make a more informed choice")).toHaveLength(2);
    expect(screen.getByText("Identity verified")).toBeInTheDocument();
    expect(screen.getByText("4.9 from verified reviews")).toBeInTheDocument();
    expect(container.querySelector('[class*="animate-in"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="animate-pulse"]')).not.toBeInTheDocument();
  });
});
