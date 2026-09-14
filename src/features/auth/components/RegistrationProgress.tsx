import { Check } from "lucide-react";

import { REGISTRATION_STEPS } from "@/features/auth/domain/registration";
import type { RegistrationStep } from "@/features/auth/types";
import { cn } from "@/lib/utils";

interface RegistrationProgressProps {
  currentStep: RegistrationStep;
  onSelectStep: (step: RegistrationStep) => void;
}

export function RegistrationProgress({ currentStep, onSelectStep }: RegistrationProgressProps) {
  return (
    <nav aria-label="Registration progress" className="mb-8">
      <ol className="grid grid-cols-4 gap-1">
        {REGISTRATION_STEPS.map((step) => {
          const isCurrent = step.number === currentStep;
          const isComplete = step.number < currentStep;

          return (
            <li key={step.number} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelectStep(step.number)}
                disabled={!isComplete}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${step.label}${isComplete ? ", completed" : isCurrent ? ", current step" : ""}`}
                className={cn(
                  "group flex min-h-11 w-full min-w-0 flex-col items-center gap-2 rounded-md px-1 py-1 text-center focus-visible:ring-2 focus-visible:ring-ring",
                  isComplete && "cursor-pointer",
                  !isComplete && !isCurrent && "cursor-default",
                )}
              >
                <span className="flex w-full items-center" aria-hidden="true">
                  <span className={cn(
                    "h-0.5 flex-1",
                    step.number === 1 ? "bg-transparent" : isComplete || isCurrent ? "bg-primary" : "bg-border",
                  )} />
                  <span className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isComplete && "border-primary bg-primary text-primary-foreground",
                    !isCurrent && !isComplete && "border-border bg-muted text-muted-foreground",
                  )}>
                    {isComplete ? <Check className="size-4" /> : step.number}
                  </span>
                  <span className={cn(
                    "h-0.5 flex-1",
                    step.number === 4 ? "bg-transparent" : isComplete ? "bg-primary" : "bg-border",
                  )} />
                </span>
                <span className={cn(
                  "hidden max-w-full text-[11px] font-semibold leading-tight sm:block",
                  isCurrent || isComplete ? "text-foreground" : "text-muted-foreground",
                )}>
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs font-medium text-muted-foreground sm:hidden">
        Step {currentStep} of 4 · {REGISTRATION_STEPS[currentStep - 1].label}
      </p>
    </nav>
  );
}
