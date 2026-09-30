import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DigitalPortfolioModal from "./DigitalPortfolioModal";

const { generateProviderPortfolioMock } = vi.hoisted(() => ({
  generateProviderPortfolioMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("@/features/profile/services/generateProviderPortfolio", () => ({
  generateProviderPortfolio: generateProviderPortfolioMock,
  getPaymentLabel: (value?: string) => value ? `GCash ${value}` : "Coordinate through TrabaWho",
}));

const provider = {
  bio: "Repairs and installs household appliances.",
  gcashNumber: "09123456789",
  isOpen: true,
  isVerified: true,
  location: "Baliuag, Bulacan",
  onClose: vi.fn(),
  profilePhoto: "https://example.com/profile.jpg",
  rating: 4.75,
  serviceType: "Appliance installation and repair",
  workerName: "Jose Miguel Ramos",
};

describe("DigitalPortfolioModal", () => {
  it("shows branded, decision-ready provider details", () => {
    render(<DigitalPortfolioModal {...provider} />);

    expect(screen.getByRole("heading", { name: "Professional portfolio preview" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Jose Miguel Ramos profile" })).toHaveAttribute("src", provider.profilePhoto);
    expect(document.querySelector('img[src="/trabawho-logo.svg"]')).toBeInTheDocument();
    expect(screen.getByText("Verified provider")).toBeInTheDocument();
    expect(screen.getAllByText("4.8 / 5").length).toBeGreaterThan(0);
    expect(screen.getByText("GCash 09123456789")).toBeInTheDocument();
    expect(screen.getByText(provider.bio)).toBeInTheDocument();
  });

  it("does not invent a rating when none is available", () => {
    render(<DigitalPortfolioModal {...provider} rating={undefined} />);
    expect(screen.getAllByText("No reviews yet").length).toBeGreaterThan(0);
  });

  it("provides a bounded touch-scrollable mobile content region", () => {
    render(<DigitalPortfolioModal {...provider} />);
    const region = screen.getByRole("region", { name: "Portfolio preview content" });
    expect(region).toHaveClass("min-h-0", "touch-pan-y", "overflow-y-auto", "overscroll-y-contain");
    expect(screen.getByRole("dialog")).toHaveClass("grid-rows-[auto_minmax(0,1fr)_auto]", "overflow-hidden");
  });

  it("downloads the visible portfolio data", async () => {
    const user = userEvent.setup();
    render(<DigitalPortfolioModal {...provider} />);

    await user.click(screen.getByRole("button", { name: /download portfolio/i }));

    expect(generateProviderPortfolioMock).toHaveBeenCalledWith(expect.objectContaining({
      isVerified: true,
      profilePhoto: provider.profilePhoto,
      ratingLabel: "4.8 / 5",
      workerName: provider.workerName,
    }));
  });
});
