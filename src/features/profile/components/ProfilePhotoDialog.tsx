import { useRef, useState, type ChangeEvent } from "react";
import { Camera, Eye, ImagePlus, Info, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProfilePhotoDialogProps {
  error?: string;
  hasPhoto: boolean;
  photoUrl: string;
  isOpen: boolean;
  isSaving: boolean;
  onImageSelection: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onRemovePhoto: () => void | Promise<void>;
}

function ProfilePhotoDialog({
  error,
  hasPhoto,
  photoUrl,
  isOpen,
  isSaving,
  onImageSelection,
  onOpenChange,
  onRemovePhoto,
}: ProfilePhotoDialogProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (isSaving) return;
    if (!open) setIsPreviewExpanded(false);
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md gap-0 overflow-y-auto p-0">
        <DialogHeader className="bg-muted/40 px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Camera className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="text-2xl">Change profile photo</DialogTitle>
          <DialogDescription className="leading-6">
            View your current photo or choose a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <section aria-label="Current profile photo" className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-4">
              <img
                src={photoUrl}
                alt={hasPhoto ? "Your current profile photo" : "Default profile image"}
                className="size-20 shrink-0 rounded-full border border-border bg-background object-cover"
              />
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-foreground">{hasPhoto ? "Your current photo" : "No photo added yet"}</p>
                <p className="text-sm text-muted-foreground">
                  {hasPhoto ? "Visible on your profile." : "Your profile uses the default image."}
                </p>
                {hasPhoto ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 px-2 text-primary hover:text-primary"
                    aria-expanded={isPreviewExpanded}
                    aria-controls="profile-photo-preview"
                    onClick={() => setIsPreviewExpanded((expanded) => !expanded)}
                  >
                    <Eye aria-hidden="true" />
                    {isPreviewExpanded ? "Hide larger view" : "View larger"}
                  </Button>
                ) : null}
              </div>
            </div>
            {hasPhoto && isPreviewExpanded ? (
              <div id="profile-photo-preview" className="mt-4 flex justify-center rounded-lg bg-background p-3">
                <img
                  src={photoUrl}
                  alt="Your current profile, enlarged"
                  className="max-h-[45dvh] max-w-full rounded-lg object-contain"
                />
              </div>
            ) : null}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="group flex min-h-28 items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              disabled={isSaving}
              onClick={() => cameraInputRef.current?.click()}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <Camera aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold text-foreground">Take a photo</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">Open your device camera.</span>
              </span>
            </button>

            <button
              type="button"
              className="group flex min-h-28 items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              disabled={isSaving}
              onClick={() => deviceInputRef.current?.click()}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <ImagePlus aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold text-foreground">Choose from device</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">Upload an existing image.</span>
              </span>
            </button>
          </div>

          <div className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="leading-5">JPG, PNG, or WEBP. Maximum file size is 2 MB.</p>
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            aria-label="Take a profile photo"
            onChange={(event) => { void onImageSelection(event); }}
          />
          <input
            ref={deviceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Choose a profile photo from device"
            onChange={(event) => { void onImageSelection(event); }}
          />
        </div>

        <DialogFooter className="justify-between bg-muted/30 px-5 py-4 sm:px-6">
          <div className="sm:mr-auto">
            {hasPhoto ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                isLoading={isSaving}
                onClick={() => { void onRemovePhoto(); }}
              >
                <Trash2 aria-hidden="true" />
                {isSaving ? "Removing photo" : "Remove photo"}
              </Button>
            ) : null}
          </div>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ProfilePhotoDialog };
