import { fireEvent, render, screen } from "@testing-library/react";

import CreateServiceModal from "./CreateServiceModal";

describe("CreateServiceModal", () => {
  it("keeps a bounded desktop width instead of expanding with the viewport", () => {
    render(
      <CreateServiceModal
        isOpen
        newService={{
          availability: {},
          basePrice: "",
          bookingMode: "with-slots",
          description: "",
          durationMinutes: "",
          priceType: "fixed",
          rateBasis: "per-project",
          shortDescription: "",
          title: "",
        }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const modal = screen.getByTestId("create-service-modal");
    expect(modal.className).toContain("!w-[min(840px,calc(100vw-2rem))]");
    expect(modal.className).toContain("!max-w-[840px]");
  });

  it("explains the shared one-booking limit without offering per-service capacity", () => {
    render(<CreateServiceModal isOpen newService={{
      title: "Home cleaning", shortDescription: "A thorough home clean", description: "",
      basePrice: 500, priceType: "fixed", rateBasis: "per-project", durationMinutes: 60,
      bookingMode: "with-slots", availability: { Mon: [{ id: "monday", startTime: "09:00", endTime: "10:00", capacity: 1 }] },
    }} onChange={vi.fn()} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/one booking at a time across all your services/i)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Capacity" })).not.toBeInTheDocument();
  });
});
