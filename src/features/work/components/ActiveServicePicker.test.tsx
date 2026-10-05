import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveServicePicker } from "./ActiveServicePicker";

const services = [
  { serviceType: "Chemical Making", raw: { id: 1 } },
  { serviceType: "Bomb Bath Making", raw: { id: 2 } },
];

describe("ActiveServicePicker", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("labels the service selector and switches to the chosen listing", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <ActiveServicePicker services={services} selectedIndex={0} onSelect={onSelect} onEditService={vi.fn()} />,
    );

    const selector = screen.getByRole("combobox", { name: "Active service" });
    expect(selector).toHaveTextContent("Chemical Making");

    selector.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("option", { name: "Bomb Bath Making" })).toBeVisible();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(1);

    rerender(<ActiveServicePicker services={services} selectedIndex={1} onSelect={onSelect} onEditService={vi.fn()} />);
    expect(selector).toHaveTextContent("Bomb Bath Making");
  });

  it("provides a fallback label for an untitled listing", async () => {
    const user = userEvent.setup();
    render(
      <ActiveServicePicker services={[services[0], { raw: { id: 3 } }]} selectedIndex={0} onSelect={vi.fn()} onEditService={vi.fn()} />,
    );

    screen.getByRole("combobox", { name: "Active service" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("option", { name: "Service 2" })).toBeVisible();
  });

  it("keeps edit and confirmed delete beside the selected service controls", async () => {
    const user = userEvent.setup();
    const onEditService = vi.fn();
    const { rerender } = render(
      <ActiveServicePicker
        services={services}
        selectedIndex={0}
        onSelect={vi.fn()}
        onEditService={onEditService}
        serviceId={1}
        sellerId="worker-1"
      />,
    );

    const panel = screen.getByRole("region", { name: "Manage your services" });
    await user.click(screen.getByRole("button", { name: "Edit service" }));
    expect(onEditService).toHaveBeenCalledOnce();
    expect(panel).toContainElement(screen.getByRole("button", { name: "Delete service" }));

    rerender(
      <ActiveServicePicker
        services={services}
        selectedIndex={1}
        onSelect={vi.fn()}
        onEditService={onEditService}
        serviceId={2}
        sellerId="worker-1"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete service" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Bomb Bath Making");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("shows a single service without an inactive dropdown and keeps its edit action", async () => {
    const user = userEvent.setup();
    const onEditService = vi.fn();
    render(
      <ActiveServicePicker services={[services[0]]} selectedIndex={0} onSelect={vi.fn()} onEditService={onEditService} />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Chemical Making")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit service" }));
    expect(onEditService).toHaveBeenCalledOnce();
  });
});
