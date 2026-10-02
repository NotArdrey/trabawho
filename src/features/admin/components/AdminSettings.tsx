import { ArrowRight, Settings2, UserRound } from "lucide-react";
import { AppearancePicker, type AppearanceChoice, type ThemeMode } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  appTheme: string;
  identity?: { fullName?: string; email?: string } | null;
  onOpenAccountSettings?: () => void;
  onThemeChange?: (mode: ThemeMode) => void;
  themeMode: ThemeMode;
}

const choices: AppearanceChoice[] = [
  { value: "system", label: "Device", description: "Matches your device" },
  { value: "light", label: "Light", description: "Bright and clear" },
  { value: "dark", label: "Dark", description: "Easier in low light" },
];

export default function AdminSettings({ appTheme, identity, onOpenAccountSettings, onThemeChange, themeMode }: Props) {
  return <section className="space-y-6">
    <div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Settings</h1><p className="mt-2 text-muted-foreground">Manage your account and how TrabaWho looks on this device.</p></div>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card><CardHeader><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound className="size-5" aria-hidden="true" /></span><div><CardTitle>My account</CardTitle><CardDescription className="mt-1">Your personal account details and security.</CardDescription></div></div></CardHeader><CardContent className="space-y-4"><dl className="grid gap-3 text-sm"><div><dt className="text-muted-foreground">Name</dt><dd className="font-medium text-foreground">{identity?.fullName || "Not available"}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="break-all font-medium text-foreground">{identity?.email || "Not available"}</dd></div></dl><Button type="button" variant="outline" onClick={onOpenAccountSettings} disabled={!onOpenAccountSettings}>Manage account & privacy<ArrowRight aria-hidden="true" /></Button></CardContent></Card>
      <Card><CardHeader><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Settings2 className="size-5" aria-hidden="true" /></span><div><CardTitle>Appearance</CardTitle><CardDescription className="mt-1">This preference also applies when you return to the main app.</CardDescription></div></div></CardHeader><CardContent><AppearancePicker appTheme={appTheme} choices={choices} description="Choose a theme or match this device automatically." label="Theme" onThemeChange={onThemeChange} themeMode={themeMode} /></CardContent></Card>
    </div>
  </section>;
}
