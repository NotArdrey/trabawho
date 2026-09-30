import { afterEach, describe, expect, it, vi } from "vitest";

const { downloadMock } = vi.hoisted(() => ({ downloadMock: vi.fn() }));

vi.mock("@/integrations/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { storage: { from: () => ({ download: downloadMock }) } },
}));

import { fetchImageBlob, getPaymentLabel, getSupabaseStorageLocation } from "./generateProviderPortfolio";

afterEach(() => {
  vi.unstubAllGlobals();
  downloadMock.mockReset();
});

describe("getPaymentLabel", () => {
  it("shows a configured GCash contact", () => {
    expect(getPaymentLabel("09123456789")).toBe("GCash 09123456789");
  });

  it("does not export placeholder account details", () => {
    expect(getPaymentLabel("09XXXXXXXXX")).toBe("Coordinate through TrabaWho");
    expect(getPaymentLabel()).toBe("Coordinate through TrabaWho");
  });
});

describe("getSupabaseStorageLocation", () => {
  it("extracts public profile-photo bucket paths", () => {
    expect(getSupabaseStorageLocation("https://project.supabase.co/storage/v1/object/public/profile-photos/user-1/photo.jpg?v=1"))
      .toEqual({ bucket: "profile-photos", path: "user-1/photo.jpg" });
  });

  it("ignores unrelated image URLs", () => {
    expect(getSupabaseStorageLocation("https://images.example.com/photo.jpg")).toBeNull();
  });

  it("downloads a Supabase photo through Storage when its public URL fails", async () => {
    const photo = new Blob(["photo"], { type: "image/jpeg" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blocked")));
    downloadMock.mockResolvedValue({ data: photo, error: null });

    await expect(fetchImageBlob("https://project.supabase.co/storage/v1/object/public/profile-photos/user-1/photo.jpg"))
      .resolves.toBe(photo);
    expect(downloadMock).toHaveBeenCalledWith("user-1/photo.jpg");
  });
});
