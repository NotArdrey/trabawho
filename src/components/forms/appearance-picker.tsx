import { useId } from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeMode = "light" | "dark" | "system";

export interface AppearanceChoice {
  value: ThemeMode;
  label: string;
  description: string;
}

interface Props {
  appTheme: string;
  choices: readonly AppearanceChoice[];
  description: string;
  label: string;
  onThemeChange?: (mode: ThemeMode) => void;
  themeMode: ThemeMode;
}

const icons = { system: Laptop, light: Sun, dark: Moon };

export function AppearancePicker({ appTheme, choices, description, label, onThemeChange, themeMode }: Props) {
  const headingId = useId();
  return <section aria-labelledby={headingId}>
    <h2 id={headingId} className="text-sm font-semibold text-foreground">{label}</h2>
    <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={label}>
      {choices.map((choice) => {
        const Icon = icons[choice.value];
        const selected = themeMode === choice.value;
        return <button key={choice.value} type="button" role="radio" aria-checked={selected} onClick={() => onThemeChange?.(choice.value)}
          className={cn("relative min-h-[92px] rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "bg-primary text-primary-foreground hover:bg-primary/90")}>
          <div className="flex items-center justify-between gap-2"><Icon className="size-5" aria-hidden="true" />{selected && <Check className="size-4" aria-hidden="true" />}</div>
          <p className="mt-3 text-sm font-semibold">{choice.label}</p>
          <p className={cn("mt-0.5 text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{choice.description}{choice.value === "system" ? ` · ${appTheme === "dark" ? "Dark" : "Light"}` : ""}</p>
        </button>;
      })}
    </div>
  </section>;
}
