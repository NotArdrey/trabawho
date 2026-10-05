import { BriefcaseBusiness, Pencil } from "lucide-react";

import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import { DeleteWorkService } from "@/features/work/components/DeleteWorkService";

interface ServiceOption {
  serviceType?: string | null;
  raw?: { id?: number | string | null; title?: string | null } | null;
}

interface ActiveServicePickerProps {
  services: readonly ServiceOption[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onEditService: () => void;
  serviceId?: number;
  sellerId?: string | null;
  onDeleted?: () => Promise<unknown> | void;
}

export function ActiveServicePicker({
  services,
  selectedIndex,
  onSelect,
  onEditService,
  serviceId,
  sellerId,
  onDeleted,
}: ActiveServicePickerProps) {
  const options = services.map((service, index) => ({
    value: String(index),
    label: service.serviceType || service.raw?.title || `Service ${index + 1}`,
  }));
  const selectedService = options[selectedIndex]?.label || options[0]?.label || "Service";

  return (
    <WorkflowPanel
      className="mx-auto mb-4 w-full max-w-[1100px]"
      contentClassName="p-4 sm:p-5"
      description={services.length > 1
        ? "Choose which of your service listings to manage below."
        : "Update or remove your service listing."}
      icon={BriefcaseBusiness}
      title="Manage your services"
      tone="primary"
    >
      {services.length > 1 ? (
        <SelectField
          label="Active service"
          value={String(selectedIndex)}
          onValueChange={(value) => {
            const index = Number(value);
            if (Number.isInteger(index) && index >= 0 && index < services.length) onSelect(index);
          }}
          options={options}
        />
      ) : (
        <div>
          <p className="text-sm font-medium text-foreground">Active service</p>
          <p className="mt-2 rounded-lg bg-muted/45 px-3 py-3 text-sm font-semibold text-foreground">{selectedService}</p>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onEditService}>
          <Pencil aria-hidden="true" />Edit service
        </Button>
        <DeleteWorkService
          serviceId={serviceId}
          sellerId={sellerId}
          title={selectedService}
          onDeleted={onDeleted}
          className="w-full sm:w-auto"
        />
      </div>
    </WorkflowPanel>
  );
}
