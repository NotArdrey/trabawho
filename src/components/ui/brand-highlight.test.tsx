import { render, screen } from "@testing-library/react";

import { Badge } from "./badge";
import { Button } from "./button";

function relativeLuminance(hex: string) {
  const channels = hex.match(/\w\w/g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("brand highlight semantics", () => {
  it("meets WCAG AA for highlight text and count treatments", () => {
    expect(contrastRatio("9a3412", "fff3e6")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("fdba74", "7c2d12")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("ffffff", "b45309")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps brand highlighting distinct from warning and primary actions", () => {
    render(
      <>
        <Badge variant="brand">Unread</Badge>
        <Badge variant="warning">Attention</Badge>
        <Button>Continue</Button>
      </>,
    );

    expect(screen.getByText("Unread")).toHaveClass("bg-brand-highlight-soft");
    expect(screen.getByText("Attention")).toHaveClass("bg-amber-100");
    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Continue" })).not.toHaveClass("bg-brand-highlight");
  });
});
