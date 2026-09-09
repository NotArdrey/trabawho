import { fireEvent, render, screen } from "@testing-library/react";

import ProfileEditModal, { type ServiceProfileDraft } from "./ProfileEditModal";

const profileData: ServiceProfileDraft = {
  afterServicePaymentType: "both",
  description: "Installs and troubleshoots household appliances.",
  fixedPrice: 850,
  fullName: "Jose Ramos",
  gcashNumber: "09123456789",
  paymentAdvance: false,
  paymentAfterService: true,
  pricingModel: "fixed",
  serviceType: "Appliance Installation & Repair",
};

describe("ProfileEditModal", () => {
  it("presents service, pricing, and payment workflow sections", () => {
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Edit service profile" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Service details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Payment options" })).toBeVisible();
  });

  it("validates required details before saving", () => {
    const onSave = vi.fn();
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/Service type/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a service type");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves the existing save contract", () => {
    const onSave = vi.fn();
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      fixedPrice: 850,
      paymentAfterService: true,
      pricingModel: "fixed",
      serviceType: "Appliance Installation & Repair",
    }));
  });
});
