import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FeaturedServices from "./FeaturedServices";

const { fetchFeaturedServicesMock } = vi.hoisted(() => ({
  fetchFeaturedServicesMock: vi.fn(),
}));

vi.mock("../services/featured-services", () => ({
  fetchFeaturedServices: fetchFeaturedServicesMock,
}));

afterEach(() => {
  fetchFeaturedServicesMock.mockReset();
});

describe("FeaturedServices", () => {
  it("renders available service facts without inventing absent fields", async () => {
    fetchFeaturedServicesMock.mockResolvedValue([
      {
        id: "service-1",
        title: "Apartment Cleaning",
        providerName: "Maria Cruz",
        serviceType: "Cleaning",
        location: "Malolos, Bulacan",
        rating: 4.9,
        reviewCount: 12,
        priceLabel: "From \u20b1900/project",
        isVerified: true,
        availabilityLabel: "Schedule available",
      },
    ]);

    render(<FeaturedServices onSelect={vi.fn()} />);

    expect(await screen.findByText("Apartment Cleaning")).toBeInTheDocument();
    expect(screen.getByText("Maria Cruz")).toBeInTheDocument();
    expect(screen.getByText("Malolos, Bulacan")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByText(/New provider/i)).not.toBeInTheDocument();
  });

  it("shows an explicit empty state", async () => {
    fetchFeaturedServicesMock.mockResolvedValue([]);
    render(<FeaturedServices onSelect={vi.fn()} />);

    expect(await screen.findByText("No featured services are available yet.")).toBeInTheDocument();
  });

  it("shows a recoverable error state", async () => {
    fetchFeaturedServicesMock.mockRejectedValue(new Error("network unavailable"));
    render(<FeaturedServices onSelect={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Featured services are unavailable right now.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("marks the listing region busy until loading completes", async () => {
    let resolveRequest: (value: unknown[]) => void = () => undefined;
    fetchFeaturedServicesMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { container } = render(
      <FeaturedServices onSelect={vi.fn()} />,
    );

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    resolveRequest([]);
    await waitFor(() => expect(container.querySelector('[aria-busy="false"]')).toBeInTheDocument());
  });
});
