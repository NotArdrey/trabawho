import { fireEvent, render, screen } from "@testing-library/react";

import QrPreviewModal from "./QrPreviewModal";

const props = {
  imageAlt: "GCash payment QR code",
  imageSrc: "data:image/png;base64,example",
  isOpen: true,
  note: "Ask your client to scan this QR during meetup.",
  onClose: vi.fn(),
  primaryLabel: "GCash number",
  primaryValue: "09054891105",
  subtitle: "Show this QR to your client during meetup.",
  title: "GCash face-to-face payment",
};

describe("QrPreviewModal", () => {
  it("groups the QR, payment identifier, and guidance", () => {
    render(<QrPreviewModal {...props} />);
    expect(screen.getByRole("dialog", { name: props.title })).toBeVisible();
    expect(screen.getByRole("img", { name: props.imageAlt })).toBeVisible();
    expect(screen.getByText(props.primaryValue)).toBeVisible();
    expect(screen.getByText(props.note)).toBeVisible();
  });

  it("closes through the standard dialog action", () => {
    const onClose = vi.fn();
    render(<QrPreviewModal {...props} onClose={onClose} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
