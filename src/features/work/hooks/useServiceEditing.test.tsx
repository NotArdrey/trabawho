import { act, renderHook } from "@testing-library/react";
import { useServiceEditing } from "./useServiceEditing";
import { saveServiceEdit } from "../services/serviceEditing";
import { serviceDraftToProfileUpdate, serviceProfileToDraft, type ServiceRow } from "../utils/serviceDraft";

vi.mock("../services/serviceEditing", () => ({ saveServiceEdit: vi.fn() }));

const row: ServiceRow = {
  id: 7, seller_id: "worker-1", title: "Repair", short_description: "Repair appliances",
  description: "Repair appliances", base_price: 850, price_type: "fixed", duration_minutes: 45,
  active: true, category_id: null, created_at: "", updated_at: "", currency: "PHP", slug: "repair", metadata: {},
};

describe("service editing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the opened listing after live updates change the active service", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn();
    vi.mocked(saveServiceEdit).mockResolvedValue(row);
    const { result, rerender } = renderHook(({ serviceId }) => useServiceEditing({
      serviceId, sellerId: "worker-1", refresh, onSaved,
    }), { initialProps: { serviceId: 7 } });
    rerender({ serviceId: 8 });
    const update = { ...serviceDraftToProfileUpdate(serviceProfileToDraft({ raw: row })), raw: row };
    await act(() => result.current(update));
    expect(saveServiceEdit).toHaveBeenCalledWith(7, "worker-1", update);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("keeps the editor open and does not refresh on a failed write", async () => {
    const refresh = vi.fn();
    const onSaved = vi.fn();
    vi.mocked(saveServiceEdit).mockRejectedValue(new Error("Unable to save the selected service."));
    const { result } = renderHook(() => useServiceEditing({ serviceId: 7, sellerId: "worker-1", refresh, onSaved }));
    await expect(result.current(serviceDraftToProfileUpdate(serviceProfileToDraft({ raw: row })))).rejects.toThrow("Unable to save");
    expect(refresh).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
