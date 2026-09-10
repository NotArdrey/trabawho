import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import LandingCategories from "./LandingCategories";

describe("LandingCategories", () => {
  it("keeps spotlight category cards keyboard-operable", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<LandingCategories onSelect={onSelect} />);

    const cleaning = screen.getByRole("button", { name: "Cleaning: Home and space cleaning" });
    await user.click(cleaning);

    expect(onSelect).toHaveBeenCalledWith({ query: "Cleaning" });
  });
});
