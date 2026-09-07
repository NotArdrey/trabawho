import { LoaderCircle } from "lucide-react";

export default function LoadingScreen() {
  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-svh items-center justify-center bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 text-primary">
        <LoaderCircle className="size-10 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <p className="m-0 text-sm font-semibold tracking-wide">Loading TrabaWho…</p>
      </div>
    </main>
  );
}
