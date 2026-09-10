import { useEffect, useState, type ChangeEvent, type ComponentType } from "react";
import {
  BellRing,
  Check,
  CheckCircle2,
  Globe2,
  Laptop,
  Mail,
  MessageSquareText,
  Moon,
  Save,
  Sun,
} from "lucide-react";

import { SelectField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import DashboardNavigation, {
  type DashboardProfile,
} from "@/shared/components/DashboardNavigation";

type NavigationHandler = () => void;
type ThemeMode = "light" | "dark" | "system";
type AppLanguage = "en" | "fil";

export interface SettingsProps {
  appLanguage?: string;
  appTheme?: string;
  currentView?: string;
  onBack?: NavigationHandler;
  onLanguageChange?: (language: AppLanguage) => void;
  onLogout?: () => void | Promise<void>;
  onOpenAccountSettings?: NavigationHandler;
  onOpenAdminDashboard?: NavigationHandler;
  onOpenBrowseServices?: NavigationHandler;
  onOpenChatPage?: NavigationHandler;
  onOpenDashboard?: NavigationHandler;
  onOpenMyBookings?: NavigationHandler;
  onOpenMyWork?: NavigationHandler;
  onOpenProfile?: NavigationHandler;
  onOpenSellerSetup?: NavigationHandler;
  onOpenSettings?: NavigationHandler;
  onSearchChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onThemeChange?: (mode: ThemeMode) => void;
  searchQuery?: string;
  sellerProfile?: DashboardProfile | null;
  themeMode?: string;
}

const translations = {
  en: {
    pageTitle: "Preferences",
    pageDescription: "Choose how TrabaWho looks, communicates, and displays content.",
    generalTitle: "Language and appearance",
    generalDescription: "Changes to these settings apply across your workspace.",
    language: "Display language",
    languageDescription: "Choose the language used for navigation and instructions.",
    english: "English",
    tagalog: "Filipino (Tagalog)",
    appearance: "Appearance",
    appearanceDescription: "Choose a theme or match this device automatically.",
    system: "Device",
    systemDescription: "Matches your device",
    light: "Light",
    lightDescription: "Bright and clear",
    dark: "Dark",
    darkDescription: "Easier in low light",
    notifications: "Notifications",
    notificationsDescription: "Control which service updates reach you.",
    email: "Email notifications",
    emailDescription: "Booking updates, messages, and important account activity.",
    sms: "SMS alerts",
    smsDescription: "Time-sensitive booking alerts sent to your mobile number.",
    on: "On",
    off: "Off",
    save: "Save preferences",
    saving: "Saving…",
    saved: "Your preferences have been saved.",
  },
  fil: {
    pageTitle: "Mga Preference",
    pageDescription: "Piliin kung paano ipinapakita at nagpapadala ng update ang TrabaWho.",
    generalTitle: "Wika at hitsura",
    generalDescription: "Malalapat ang mga pagbabagong ito sa buong workspace mo.",
    language: "Wika ng display",
    languageDescription: "Piliin ang wikang gagamitin sa navigation at mga instruction.",
    english: "English",
    tagalog: "Filipino (Tagalog)",
    appearance: "Hitsura",
    appearanceDescription: "Pumili ng tema o awtomatikong sundin ang device na ito.",
    system: "Device",
    systemDescription: "Sinusunod ang device mo",
    light: "Light",
    lightDescription: "Maliwanag at malinaw",
    dark: "Dark",
    darkDescription: "Mas komportable sa dilim",
    notifications: "Mga Notification",
    notificationsDescription: "Kontrolin kung aling service updates ang matatanggap mo.",
    email: "Email notifications",
    emailDescription: "Mga update sa booking, mensahe, at mahalagang account activity.",
    sms: "SMS alerts",
    smsDescription: "Mahahalagang booking alert na ipapadala sa mobile number mo.",
    on: "On",
    off: "Off",
    save: "I-save ang preferences",
    saving: "Sine-save…",
    saved: "Na-save na ang iyong preferences.",
  },
} as const;

interface ThemeChoice {
  value: ThemeMode;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

interface PreferenceSwitchProps {
  checked: boolean;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  offLabel: string;
  onChange: (checked: boolean) => void;
  onLabel: string;
}

function PreferenceSwitch({
  checked,
  description,
  icon: Icon,
  label,
  offLabel,
  onChange,
  onLabel,
}: PreferenceSwitchProps) {
  return (
    <div className="flex min-h-20 items-center gap-3 px-4 py-3 max-sm:items-start">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden={true} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <span className="min-w-6 text-right text-xs font-semibold text-muted-foreground">
          {checked ? onLabel : offLabel}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            checked ? "bg-primary" : "bg-muted-foreground/25",
          )}
        >
          <span
            className={cn(
              "absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform",
              checked && "translate-x-5",
            )}
          />
        </button>
      </div>
    </div>
  );
}

function Settings({
  appLanguage = "en",
  appTheme = "light",
  currentView,
  onLanguageChange,
  onLogout,
  onOpenAccountSettings,
  onOpenAdminDashboard,
  onOpenBrowseServices,
  onOpenChatPage,
  onOpenDashboard,
  onOpenMyBookings,
  onOpenMyWork,
  onOpenProfile,
  onOpenSellerSetup,
  onOpenSettings,
  onSearchChange,
  onThemeChange,
  searchQuery,
  sellerProfile,
  themeMode = "system",
}: SettingsProps) {
  const language: AppLanguage = appLanguage === "fil" ? "fil" : "en";
  const selectedTheme: ThemeMode =
    themeMode === "light" || themeMode === "dark" ? themeMode : "system";
  const t = translations[language];
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!saveMessage) return;
    const timer = window.setTimeout(() => setSaveMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  const themeChoices: ThemeChoice[] = [
    { value: "system", label: t.system, description: t.systemDescription, icon: Laptop },
    { value: "light", label: t.light, description: t.lightDescription, icon: Sun },
    { value: "dark", label: t.dark, description: t.darkDescription, icon: Moon },
  ];

  const handleSave = () => {
    setSaveMessage("");
    setIsSaving(true);
    window.setTimeout(() => {
      setIsSaving(false);
      setSaveMessage(t.saved);
    }, 500);
  };

  return (
    <div className="gl-page min-h-screen bg-background" data-testid="preferences-page">
      <DashboardNavigation
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup}
        onOpenMyBookings={onOpenMyBookings}
        onOpenChatPage={onOpenChatPage}
        sellerProfile={sellerProfile}
        onOpenMyWork={onOpenMyWork}
        onOpenProfile={onOpenProfile}
        onOpenAccountSettings={onOpenAccountSettings}
        onOpenSettings={onOpenSettings}
        onOpenDashboard={onOpenDashboard}
        onOpenBrowseServices={onOpenBrowseServices}
        isAdminView={false}
        onToggleAdminView={() => onOpenAdminDashboard?.()}
      />

      <main className="mx-auto w-full max-w-[1040px] px-6 pb-32 pt-8 max-[880px]:px-3 max-[880px]:pb-[calc(6.5rem+env(safe-area-inset-bottom))] max-[880px]:pt-5">
        <header className="mb-6">
          <p className="text-sm font-semibold text-primary">Workspace settings</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground max-sm:text-2xl">
            {t.pageTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t.pageDescription}
          </p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Globe2 className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-lg">{t.generalTitle}</CardTitle>
                  <CardDescription className="mt-1 leading-5">{t.generalDescription}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <SelectField
                id="display-language"
                label={t.language}
                description={t.languageDescription}
                value={language}
                onValueChange={(value) => onLanguageChange?.(value as AppLanguage)}
                options={[
                  { value: "en", label: t.english },
                  { value: "fil", label: t.tagalog },
                ]}
              />

              <section aria-labelledby="appearance-heading">
                <h2 id="appearance-heading" className="text-sm font-semibold text-foreground">
                  {t.appearance}
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{t.appearanceDescription}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.appearance}>
                  {themeChoices.map(({ value, label, description, icon: Icon }) => {
                    const isSelected = selectedTheme === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onThemeChange?.(value)}
                        className={cn(
                          "relative min-h-[92px] rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Icon className="size-5" aria-hidden={true} />
                          {isSelected ? <Check className="size-4" aria-hidden="true" /> : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold">{label}</p>
                        <p className={cn("mt-0.5 text-xs", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {description}{value === "system" ? ` · ${appTheme === "dark" ? t.dark : t.light}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BellRing className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-lg">{t.notifications}</CardTitle>
                  <CardDescription className="mt-1 leading-5">{t.notificationsDescription}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <PreferenceSwitch
                label={t.email}
                description={t.emailDescription}
                icon={Mail}
                checked={emailNotifications}
                onChange={setEmailNotifications}
                onLabel={t.on}
                offLabel={t.off}
              />
              <div className="mx-4 h-px bg-border" />
              <PreferenceSwitch
                label={t.sms}
                description={t.smsDescription}
                icon={MessageSquareText}
                checked={smsAlerts}
                onChange={setSmsAlerts}
                onLabel={t.on}
                offLabel={t.off}
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex min-h-16 items-center justify-between gap-4 rounded-xl bg-card px-5 py-3 shadow-sm max-sm:flex-col max-sm:items-stretch">
          <div className="min-h-5" aria-live="polite" role="status">
            {saveMessage ? (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {saveMessage}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Your notification choices are saved when you select the button.</p>
            )}
          </div>
          <Button type="button" onClick={handleSave} isLoading={isSaving} className="min-w-44 max-sm:w-full">
            <Save className="size-4" aria-hidden="true" />
            {isSaving ? t.saving : t.save}
          </Button>
        </div>
      </main>
    </div>
  );
}

export default Settings;
