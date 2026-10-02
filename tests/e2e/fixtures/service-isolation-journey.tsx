import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/forms";
import ProfileEditModal from "@/features/work/components/ProfileEditModal";
import { useServiceEditing } from "@/features/work/hooks/useServiceEditing";
import type { ServiceRow } from "@/features/work/utils/serviceDraft";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/globals.css";

async function loadServices() {
  const response = await supabase.from("services").select("*").eq("seller_id", "worker-1").order("id");
  if (response.error) throw new Error("Unable to load services.");
  return response.data;
}

function Journey() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [selected, setSelected] = useState(7);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setServices(await loadServices());
  }, []);
  useEffect(() => { void loadServices().then(setServices).catch(() => setError("Unable to load services.")); }, []);
  const current = services.find((service) => service.id === selected);
  const save = useServiceEditing({ serviceId: current?.id, sellerId: "worker-1", refresh, onSaved: () => setEditing(false) });
  return <main className="mx-auto max-w-3xl space-y-4 p-4">
    <h1>Manage my work</h1>
    {error ? <p role="alert">{error}</p> : null}
    <SelectField label="Active service" value={String(selected)} onValueChange={(value) => setSelected(Number(value))}
      options={services.map((service) => ({ value: String(service.id), label: service.title }))} />
    {current ? <section aria-label="Current service summary">
      <h2>{current.title}</h2><p>{current.description}</p><p>PHP {current.base_price}</p>
      <Button onClick={() => setEditing(true)}>Edit service</Button>
    </section> : null}
    <ProfileEditModal isOpen={editing} profileData={{ raw: current, paymentAfterService: true }} onSave={save} onClose={() => setEditing(false)} />
  </main>;
}

const element = document.getElementById("root");
if (element) createRoot(element).render(<Journey />);
