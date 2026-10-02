import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IdentityDetail } from "./types";

export function IdentityEvidence({ detail, onRefresh }: { detail: IdentityDetail; onRefresh: () => void }) {
  return <section className="space-y-3" aria-labelledby="identity-evidence-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="identity-evidence-title" className="text-lg font-semibold">Identity evidence</h3>
      <Button type="button" variant="outline" onClick={onRefresh}><RefreshCw aria-hidden="true" />Refresh evidence</Button>
    </div>
    <p className="text-sm text-muted-foreground">Compare the ID, selfie, legal name, and expiry before deciding. Private image links expire after five minutes.</p>
    {detail.warnings.map((warning) => <p key={warning} role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{warning}</p>)}
    {detail.didit && <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
      <p className="font-semibold">Didit result: {detail.didit.status || "Unavailable"}</p>
      {detail.didit.name && <p>Name on document: {detail.didit.name}</p>}
      {detail.didit.expiry && <p>Document expiry: {detail.didit.expiry}</p>}
      {detail.didit.checks.map((check, i) => <p key={`${check.label}-${i}`} className="capitalize">{check.label}: {check.status}</p>)}
      {detail.didit.warnings.length > 0 && <ul className="list-disc space-y-1 pl-5">{detail.didit.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
      <Button asChild variant="outline"><a href="https://business.didit.me/" target="_blank" rel="noopener noreferrer">Open Didit console<ExternalLink aria-hidden="true" /></a></Button>
    </div>}
    {detail.images.length > 0 ? <div className="grid gap-4 sm:grid-cols-2">{detail.images.map((image, i) =>
      <figure key={`${image.label}-${i}`} className="min-w-0 space-y-2 rounded-lg border p-3">
        <img src={image.url} alt={image.label} referrerPolicy="no-referrer" className="h-52 w-full rounded-md bg-muted object-contain" />
        <figcaption className="font-semibold">{image.label}</figcaption>
        <Button asChild variant="outline" className="w-full"><a href={image.url} target="_blank" rel="noopener noreferrer">Open full image<ExternalLink aria-hidden="true" /></a></Button>
      </figure>)}</div> : <p className="rounded-lg border p-3 text-sm">No images are available here. Retry loading the evidence or review the session in the Didit console before approving.</p>}
  </section>;
}
