import { useState } from "react";
import { createRoot } from "react-dom/client";

import AdminAccountsTable from "@/features/admin/components/AdminAccountsTable";
import type { AdminAccount } from "@/features/admin/types";
import "@/styles/globals.css";

const accounts: AdminAccount[] = [
  { id: "client-1", name: "Ana Client", email: "ana@example.com", role: "client", displayStatus: "active" },
  { id: "worker-1", name: "Ben Worker", email: "ben@example.com", role: "worker", displayStatus: "active" },
  { id: "admin-1", name: "Cara Admin", email: "cara@example.com", role: "admin", displayStatus: "active" },
];

function TestPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const filtered = accounts.filter((account) => (role === "all" || account.role === role)
    && `${account.name} ${account.email} ${account.role}`.toLowerCase().includes(search.toLowerCase()));

  return <main className="mx-auto min-h-screen max-w-6xl bg-background p-4 sm:p-6">
    <AdminAccountsTable accounts={filtered} isLoading={false} error="" onRetry={() => undefined}
      searchQuery={search} onSearchChange={setSearch} selectedRole={role} onRoleFilterChange={setRole}
      roleSavingId={null} accessSaving={false} onUpdateRole={() => undefined}
      onOpenAccessAction={() => undefined} onRestoreAccount={() => undefined} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<TestPage />);
