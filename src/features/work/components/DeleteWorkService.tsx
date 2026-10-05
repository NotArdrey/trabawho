import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ConfirmActionModal from "@/shared/components/ConfirmActionModal";
import { deleteWorkService } from "../services/workDeletion";

interface Props { serviceId?: number; sellerId?: string | null; title: string; onDeleted?: () => Promise<unknown> | void; className?: string }
export function DeleteWorkService({ serviceId, sellerId, title, onDeleted, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  if (!serviceId || !sellerId) return null;
  const confirm = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await deleteWorkService(serviceId, sellerId);
      setOpen(false);
      await onDeleted?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete this service. Try again.");
    } finally { saving.current = false; setBusy(false); }
  };
  return <>
    <Button type="button" variant="outline" className={cn("text-destructive", className)} onClick={() => { setError(""); setOpen(true); }}><Trash2 aria-hidden="true" />Delete service</Button>
    <ConfirmActionModal isOpen={open} title="Delete this service?" description="This removes the listing from My Work and stops new bookings. Existing bookings and chats remain available." variant="destructive" confirmLabel="Delete service" isConfirming={busy} onCancel={() => { if (!saving.current) setOpen(false); }} onConfirm={() => { void confirm(); }}>
      <p>Delete <strong>{title}</strong>?</p>
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
    </ConfirmActionModal>
  </>;
}
