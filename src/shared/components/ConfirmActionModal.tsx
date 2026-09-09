import type { ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  appTheme?: "light" | "dark";
  variant?: "default" | "destructive";
  isConfirming?: boolean;
}

const destructiveLabel = /delete|remove|suspend|block|reject|cancel/i;

export default function ConfirmActionModal({
  isOpen,
  title,
  description,
  children,
  onCancel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  variant,
  isConfirming = false,
}: ConfirmActionModalProps) {
  const resolvedVariant = variant || (destructiveLabel.test(confirmLabel) ? "destructive" : "default");
  const Icon = resolvedVariant === "destructive" ? TriangleAlert : CircleAlert;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${resolvedVariant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description ? <AlertDialogDescription className="mt-1">{description}</AlertDialogDescription> : null}
            </div>
          </div>
        </AlertDialogHeader>
        {children ? <div className="rounded-lg bg-muted/50 p-4 text-sm leading-6">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isConfirming}>{cancelLabel}</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" variant={resolvedVariant === "destructive" ? "destructive" : "primary"} isLoading={isConfirming} onClick={onConfirm}>{isConfirming ? "Please wait…" : confirmLabel}</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
