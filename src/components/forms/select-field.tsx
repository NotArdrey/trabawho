import { useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: readonly SelectFieldOption[];
  label: string;
  placeholder?: string;
  description?: ReactNode;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  triggerClassName?: string;
}

function SelectField({
  value,
  onValueChange,
  options,
  label,
  placeholder = "Select an option",
  description,
  error,
  disabled = false,
  required = false,
  name,
  id,
  className,
  triggerClassName,
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required ? (
          <span className="ml-1 text-[var(--brand-orange)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        required={required}
        name={name}
      >
        <SelectTrigger
          id={fieldId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className={cn(error && "border-destructive focus:ring-destructive", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { SelectField };
