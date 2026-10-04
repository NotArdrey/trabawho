import { useState } from "react";
import { createRoot } from "react-dom/client";
import AccountPrivacyPanel from "@/features/profile/components/AccountPrivacyPanel";
import "@/styles/globals.css";

function Journey() {
  const [passwordRequests, setPasswordRequests] = useState(0);
  return (
    <main className="mx-auto max-w-4xl p-4">
      <AccountPrivacyPanel
        collapsible={false}
        sellerProfile={{ firstName: "Jose", middleName: "Miguel", lastName: "Ramos", email: "jose@example.test", phoneNumber: "09171234567" }}
        userLocation={{ address: "San Roque", city: "Baliuag", barangay: "San Roque", province: "Bulacan" }}
        onUpdateProfile={() => Promise.resolve()}
        onUpdatePassword={({ currentPassword, newPassword }) => {
          if (currentPassword === "old-password" && newPassword === "new-password") setPasswordRequests((count) => count + 1);
          return Promise.resolve();
        }}
      />
      <output data-testid="password-requests">{passwordRequests}</output>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Journey />);
