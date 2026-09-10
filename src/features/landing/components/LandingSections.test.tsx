import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import LandingSections from "./LandingSections";

describe("LandingSections", () => {
  it("keeps the emphasized provider call to action functional", async () => {
    const user = userEvent.setup();
    const onBecomeProvider = vi.fn();
    render(<LandingSections onBecomeProvider={onBecomeProvider} />);

    await user.click(screen.getByRole("button", { name: "Become a service provider" }));
    expect(onBecomeProvider).toHaveBeenCalledOnce();
  });
});
