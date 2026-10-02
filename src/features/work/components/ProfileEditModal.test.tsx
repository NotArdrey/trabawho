import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ProfileEditModal, { type ServiceProfileDraft } from "./ProfileEditModal";
import type { ServiceRow } from "../utils/serviceDraft";
import { ActionError } from "@/shared/utils/actionError";

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
  it("shows safe partial-save feedback without discarding edits", async () => {
    const message = "Your listing was saved, but payment preferences could not be saved. Your edits are still here; try again.";
    const onSave = vi.fn().mockRejectedValue(new ActionError(message));
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
    expect(screen.getByRole("dialog")).toBeVisible();
  });
  it("keeps the original service identity when the selected listing changes during editing", async () => {
    const raw: ServiceRow = { id: 7, seller_id: "worker-1", title: "Repair", short_description: "Appliance repair", description: "Appliance repair", base_price: 850, price_type: "fixed", duration_minutes: 45, metadata: {}, active: true, category_id: null, created_at: "", updated_at: "", currency: "PHP", slug: "repair" };
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(<ProfileEditModal isOpen profileData={{ ...profileData, raw }} onClose={onClose} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Service title/), { target: { value: "Updated appliance repair" } });
    rerender(<ProfileEditModal isOpen profileData={{ ...profileData, raw: { ...raw, id: 8, title: "Computer repair" } }} onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ raw, serviceType: "Updated appliance repair" })));
  });

  it("presents the same listing fields and steps as add service", () => {
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Edit service" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Service details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeVisible();
    expect(screen.getByLabelText(/Short description/)).toBeVisible();
    expect(screen.getByLabelText("Estimated duration")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Payment options" })).toBeVisible();
  });

  it("validates required details before saving", () => {
    const onSave = vi.fn();
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/Service title/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a service title");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves payment preferences and saves listing fields", async () => {
    const onSave = vi.fn();
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      shortDescription: profileData.description,
      basePrice: 850,
      fixedPrice: 850,
      paymentAfterService: true,
      pricingModel: "fixed",
      serviceType: "Appliance Installation & Repair",
    })));
  });

  it("keeps edits available after a failed save and allows a retry", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ id: 7 });
    render(<ProfileEditModal isOpen profileData={profileData} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Service title/i), { target: { value: "Updated repair" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to save all changes"));
    expect(screen.getByRole("dialog", { name: "Edit service" })).toBeVisible();
    expect(screen.getByText("Updated repair")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it("requires a payment preference before review", () => {
    render(<ProfileEditModal isOpen profileData={{ ...profileData, paymentAfterService: false }} onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one payment method");
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});
