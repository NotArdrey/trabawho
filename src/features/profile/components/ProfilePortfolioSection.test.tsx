import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfilePortfolioSection } from "./ProfilePortfolioSection";

describe("ProfilePortfolioSection", () => {
  it("keeps both portfolio actions prominent and functional", () => {
    const onPreview = vi.fn();
    const onChooseFile = vi.fn();

    render(
      <ProfilePortfolioSection
        documents={[]}
        isUploading={false}
        onPreview={onPreview}
        onChooseFile={onChooseFile}
        onRemoveDocument={vi.fn()}
      />,
    );

    const preview = screen.getByRole("button", { name: "Preview portfolio" });
    const choose = screen.getByRole("button", { name: "Choose file" });
    expect(preview).toHaveClass("bg-primary");
    expect(choose).toHaveClass("bg-primary");

    fireEvent.click(preview);
    fireEvent.click(choose);
    expect(onPreview).toHaveBeenCalledOnce();
    expect(onChooseFile).toHaveBeenCalledOnce();
  });
});
