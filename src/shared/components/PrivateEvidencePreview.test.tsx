import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrivateEvidencePreview } from "./PrivateEvidencePreview";

describe("PrivateEvidencePreview", () => {
  it("loads a private image inside the dialog and restores access on retry", async () => {
    const loadUrl = vi.fn().mockRejectedValueOnce(new Error("expired"))
      .mockResolvedValueOnce("https://example.test/signed-image");
    render(<PrivateEvidencePreview path="booking/report.jpg" title="Report image" loadUrl={loadUrl} onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable or access has expired/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
    expect(await screen.findByRole("img", { name: "Report image" })).toHaveAttribute("src", "https://example.test/signed-image");
    expect(loadUrl).toHaveBeenCalledTimes(2);
  });

  it("shows a recoverable error when an image cannot render", async () => {
    const loadUrl = vi.fn().mockResolvedValue("https://example.test/signed-image");
    render(<PrivateEvidencePreview path="booking/report.jpg" title="Report image" loadUrl={loadUrl} onClose={vi.fn()} />);
    fireEvent.error(await screen.findByRole("img", { name: "Report image" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not be displayed/i));
  });
});
