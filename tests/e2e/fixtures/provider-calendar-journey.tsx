import { useState } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import SlotEditModal from "@/features/work/components/SlotEditModal";
import "@/styles/globals.css";

function Journey() {
  const [open, setOpen] = useState(false);
  const [savedCapacity, setSavedCapacity] = useState<number | null>(null);
  return <main className="p-4">
    <Button onClick={() => setOpen(true)}>Edit time slot</Button>
    {savedCapacity !== null ? <p role="status">Saved capacity: {savedCapacity}</p> : null}
    <SlotEditModal isOpen={open} mode="with-slots" dayLabel="Monday"
      slotData={{ startTime: "09:00", endTime: "10:00", capacity: 3 }}
      onClose={() => setOpen(false)} onSave={(slot) => {
        setSavedCapacity(Number(slot.capacity));
        setOpen(false);
      }} />
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Journey />);
