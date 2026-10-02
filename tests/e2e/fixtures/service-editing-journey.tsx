import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import CreateServiceModal, { type NewServiceDraft } from "@/features/work/components/CreateServiceModal";
import ProfileEditModal from "@/features/work/components/ProfileEditModal";
import { saveServiceEdit } from "@/features/work/services/serviceEditing";
import { buildServiceUpdate, serviceDraftToProfileUpdate, type ServiceRow } from "@/features/work/utils/serviceDraft";
import { Button } from "@/components/ui/button";
import "@/styles/globals.css";

function Journey() {
  const [mode, setMode] = useState<"create" | "edit" | null>("create");
  const [row, setRow] = useState<ServiceRow | null>(null);
  const [draft, setDraft] = useState<NewServiceDraft>({ title: "", shortDescription: "", description: "", basePrice: "", priceType: "fixed", rateBasis: "per-project", durationMinutes: "", bookingMode: "with-slots", availability: {} });
  return <main className="p-6">
    <h1>Service management</h1>
    {row ? <><h2>{row.title}</h2><p>{row.short_description}</p><Button onClick={() => setMode("edit")}>Edit service</Button><pre data-testid="saved-service">{JSON.stringify(row)}</pre></> : null}
    {mode === "create" ? <CreateServiceModal isOpen newService={draft} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onClose={() => setMode(null)} onSubmit={() => {
      const created = { id: 7, seller_id: "worker-1", slug: "test", currency: "PHP", category_id: null, active: true, created_at: "", updated_at: "", ...buildServiceUpdate(serviceDraftToProfileUpdate(draft), { ad_booster: { active: true } }) } as ServiceRow;
      setRow(created); setMode(null); return Promise.resolve(created);
    }} /> : null}
    {mode === "edit" && row ? <ProfileEditModal isOpen profileData={{ raw: row, paymentAfterService: true, paymentAdvance: false }} onClose={() => setMode(null)} onSave={async (update) => {
      const saved = await saveServiceEdit(row.id, row.seller_id, update);
      setRow(saved); setMode(null); return saved;
    }} /> : null}
  </main>;
}

declare global { interface Window { serviceEditingJourneyRoot?: Root } }
const element = document.getElementById("root");
if (element) {
  window.serviceEditingJourneyRoot ??= createRoot(element);
  window.serviceEditingJourneyRoot.render(<Journey />);
}
