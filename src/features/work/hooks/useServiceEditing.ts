import { useCallback } from "react";
import type { ServiceProfileUpdate } from "../components/ProfileEditModal";
import { saveServiceEdit } from "../services/serviceEditing";

export function useServiceEditing({ serviceId, sellerId, refresh, onSaved }: {
  serviceId?: number; sellerId?: string | null; refresh: () => Promise<unknown>; onSaved: () => void;
}) {
  return useCallback(async (profile: ServiceProfileUpdate) => {
    const editedServiceId = profile.raw?.id ?? serviceId;
    if (!editedServiceId || !sellerId || (profile.raw && profile.raw.seller_id !== sellerId)) {
      throw new Error("Select a service to edit.");
    }
    const saved = await saveServiceEdit(editedServiceId, sellerId, profile);
    await refresh();
    onSaved();
    return saved;
  }, [serviceId, sellerId, refresh, onSaved]);
}
