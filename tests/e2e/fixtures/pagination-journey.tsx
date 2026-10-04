import { useState } from "react";
import { createRoot } from "react-dom/client";

import { DataPagination } from "@/components/ui/data-pagination";

function PaginationJourney() {
  const [page, setPage] = useState(5);
  return <main className="min-h-screen px-4 py-8"><h1>Support cases</h1><DataPagination label="Support case pages" page={page} pageCount={20} onPageChange={setPage} /></main>;
}

createRoot(document.getElementById("root")!).render(<PaginationJourney />);
