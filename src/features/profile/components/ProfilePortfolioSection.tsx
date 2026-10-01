import { Download, FileText } from "lucide-react";

import { Attachment, AttachmentUpload } from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";

interface PortfolioDocument {
  name: string;
  publicUrl: string;
  size?: number;
  storagePath?: string;
  uploadedAt?: string;
}

interface ProfilePortfolioSectionProps {
  documents: PortfolioDocument[];
  isUploading: boolean;
  onChooseFile: () => void;
  onPreview: () => void;
  onRemoveDocument: (storagePath?: string) => void;
}

export function ProfilePortfolioSection({ documents, isUploading, onChooseFile, onPreview, onRemoveDocument }: ProfilePortfolioSectionProps) {
  return (
    <section className="profile-flat-section border-t border-border py-6" aria-labelledby="professional-portfolio-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="professional-portfolio-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FileText className="size-5 text-primary" aria-hidden="true" />Professional portfolio
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Preview a shareable PDF with your profile details and verification QR code.</p>
        </div>
        <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={onPreview}>
          <Download aria-hidden="true" />Preview portfolio
        </Button>
      </div>

      <div className="mt-5"><AttachmentUpload onChoose={onChooseFile} isUploading={isUploading} /></div>

      {documents.length > 0 ? (
        <div className="mt-3 grid gap-2" aria-label="Portfolio documents">
          {documents.map((document) => (
            <Attachment
              key={document.storagePath || document.publicUrl}
              name={document.name}
              href={document.publicUrl}
              description={`${document.uploadedAt ? String(document.uploadedAt).slice(0, 10) : "Uploaded"} · ${Math.ceil((document.size || 0) / 1024)} KB`}
              onRemove={() => onRemoveDocument(document.storagePath)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
