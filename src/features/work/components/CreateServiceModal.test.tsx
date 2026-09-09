import { render, screen } from "@testing-library/react";

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
});
