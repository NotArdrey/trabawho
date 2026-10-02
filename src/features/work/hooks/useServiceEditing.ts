import { useCallback } from "react";
import { ActionError } from "@/shared/utils/actionError";
import type { ServiceProfileUpdate } from "../components/ProfileEditModal";
import { saveServiceEdit } from "../services/serviceEditing";

export function useServiceEditing({ serviceId, sellerId, refresh, onSaved }: {
  serviceId?: number; sellerId?: string | null; refresh: () => Promise<unknown>; onSaved: () => void;
}) {
  return useCallback(async (profile: ServiceProfileUpdate) => {
    const editedServiceId = profile.raw?.id ?? serviceId;
    if (!editedServiceId || !sellerId || (profile.raw && profile.raw.seller_id !== sellerId)) {
      throw new ActionError("Select a service to edit.");
    }
    const saved = await saveServiceEdit(editedServiceId, sellerId, profile);
    try {
      await refresh();
    } catch {
      throw new ActionError("Your changes were saved, but the page could not refresh. Refresh the page to see them.");
    }
    onSaved();
    return saved;
  }, [serviceId, sellerId, refresh, onSaved]);
}
