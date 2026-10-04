import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        availabilityLabel: "Check booking times",
      },
    ]);

    render(<FeaturedServices onSelect={vi.fn()} />);

    expect(await screen.findByText("Apartment Cleaning")).toBeInTheDocument();
    expect(screen.getByText("Maria Cruz")).toBeInTheDocument();
    expect(screen.getByText("Malolos, Bulacan")).toBeInTheDocument();
    expect(screen.getByText("Verified provider")).toBeInTheDocument();
    expect(screen.queryByText(/New provider/i)).not.toBeInTheDocument();
  });

  it("shows an explicit empty state", async () => {
    fetchFeaturedServicesMock.mockResolvedValue([]);
    render(<FeaturedServices onSelect={vi.fn()} />);

    expect(await screen.findByText("No services have been listed yet.")).toBeInTheDocument();
  });

  it("shows a recoverable error state", async () => {
    fetchFeaturedServicesMock.mockRejectedValue(new Error("network unavailable"));
    render(<FeaturedServices onSelect={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Featured services are unavailable right now.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("keeps missing photos compact, avoids duplicate titles, and labels search navigation", async () => {
    fetchFeaturedServicesMock.mockResolvedValue([{
      id: "service-2", title: "Chemical Making", serviceType: "Chemical Making",
      providerName: "Jose Ramos", isVerified: false,
    }]);
    const onSelect = vi.fn();
    render(<FeaturedServices onSelect={onSelect} />);
    await screen.findByRole("heading", { name: "Chemical Making" });
    expect(screen.getAllByText("Chemical Making")).toHaveLength(1);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("Schedule available")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse similar services" }));
    expect(onSelect).toHaveBeenCalledWith({ query: "Chemical Making" });
  });

  it("removes a failed service image", async () => {
    fetchFeaturedServicesMock.mockResolvedValue([{
      id: "service-3", title: "Repair", serviceType: "Technician",
      providerName: "Ana", photoUrl: "/missing.jpg", isVerified: false,
    }]);
    render(<FeaturedServices onSelect={vi.fn()} />);
    fireEvent.error(await screen.findByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
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
