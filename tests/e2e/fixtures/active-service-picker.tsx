import { useState } from "react";
import { createRoot } from "react-dom/client";

import { ActiveServicePicker } from "@/features/work/components/ActiveServicePicker";
import WorkProviderSummary from "@/features/work/components/WorkProviderSummary";
import "@/styles/globals.css";

const services = [
  { serviceType: "Chemical Making", raw: { id: 1 } },
  { serviceType: "Bomb Bath Making", raw: { id: 2 } },
  { serviceType: "Appliance Installation & Repair", raw: { id: 3 } },
];

function TestPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editCount, setEditCount] = useState(0);
  const visibleServices = new URLSearchParams(window.location.search).has("single") ? services.slice(0, 1) : services;

  return (
    <main className="mx-auto min-h-screen max-w-screen-xl bg-background p-4 sm:p-6">
      <ActiveServicePicker
        services={visibleServices}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onEditService={() => setEditCount((count) => count + 1)}
        serviceId={visibleServices[selectedIndex].raw.id}
        sellerId="worker-1"
      />
      <WorkProviderSummary
        name="Jose Miguel Miguel Ramos"
        service={visibleServices[selectedIndex].serviceType}
        price="PHP 850/project"
        location="Sabang, Baliwag, Bulacan"
        bookingMode="Time-slot booking"
        activeBookings={1}
        averageRating="4.67"
        completed={1}
        description="Installation and repair work."
        duration="Flexible"
        payment="After service"
        booster="Not boosted"
      />
      <p data-testid="selected-service">{visibleServices[selectedIndex].serviceType}</p>
      <p data-testid="edit-count">{editCount}</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<TestPage />);
