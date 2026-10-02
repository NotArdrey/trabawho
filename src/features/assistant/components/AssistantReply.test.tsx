import { render, screen } from "@testing-library/react";
import { AssistantReply } from "./AssistantReply";

it("renders refund instructions with emphasis and numbered steps", () => {
  render(<AssistantReply content={'Use **My Bookings**.\n\n**Quick steps**\n\n1. **Open My Bookings**\n2. Tap **Request Refund**.'} />);
  expect(screen.getByText("My Bookings").tagName).toBe("STRONG");
  expect(screen.getByRole("list").tagName).toBe("OL");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(document.body.textContent).not.toContain("**");
});

it("does not execute HTML or unsafe links from assistant replies", () => {
  const { container } = render(<AssistantReply content={'<script>alert(1)</script>\n\n[Bad link](javascript:alert%281%29)\n\n[Help](https://example.com/help)'} />);
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByText("Bad link").tagName).toBe("SPAN");
  expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("rel", "noopener noreferrer");
});
