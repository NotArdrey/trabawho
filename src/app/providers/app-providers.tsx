import type { PropsWithChildren } from "react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster closeButton richColors position="top-right" />
    </TooltipProvider>
  );
}
