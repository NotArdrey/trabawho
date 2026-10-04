import { useState } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import { ProfilePhotoDialog } from "@/features/profile/components/ProfilePhotoDialog";
import "@/styles/globals.css";

const photoUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="#dbeafe"/><circle cx="240" cy="190" r="85" fill="#1d4ed8"/><path d="M85 445c15-95 85-145 155-145s140 50 155 145" fill="#1d4ed8"/></svg>')}`;

function Journey() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <main className="p-4">
      <Button onClick={() => setIsOpen(true)}>Change profile photo</Button>
      <ProfilePhotoDialog
        hasPhoto
        photoUrl={photoUrl}
        isOpen={isOpen}
        isSaving={false}
        onImageSelection={() => {}}
        onOpenChange={setIsOpen}
        onRemovePhoto={() => {}}
      />
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Journey />);
