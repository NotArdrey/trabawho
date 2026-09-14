import { useEffect } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ManualIdentityStep } from "@/features/auth/components/ManualIdentityStep";
import { RegistrationAccountStep } from "@/features/auth/components/RegistrationAccountStep";
import { RegistrationLocationStep } from "@/features/auth/components/RegistrationLocationStep";
import { RegistrationProgress } from "@/features/auth/components/RegistrationProgress";
import { RegistrationReviewStep } from "@/features/auth/components/RegistrationReviewStep";
import { RegistrationSecurityStep } from "@/features/auth/components/RegistrationSecurityStep";
import { useRegistrationController } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";
import BrandWordmark from "@/shared/components/BrandWordmark";

interface RegistrationPageProps {
  onBack: () => void;
  onLogin: () => void;
}

export default function RegistrationPage({ onBack, onLogin }: RegistrationPageProps) {
  const registration = useRegistrationController();

  useEffect(() => {
    const headingId = registration.phase === "manual"
      ? "manual-identity-heading"
      : registration.phase === "didit"
        ? "didit-heading"
        : registration.phase === "outcome"
          ? "registration-outcome-heading"
          : "registration-step-heading";
    window.requestAnimationFrame(() => document.getElementById(headingId)?.focus());
  }, [registration.phase, registration.step]);

  const retryLocation = () => {
    if (registration.location.selectedCityCode) {
      void registration.selectCity(registration.location.selectedCityCode);
    } else if (registration.location.selectedProvinceCode) {
      void registration.selectProvince(registration.location.selectedProvinceCode);
    } else {
      void registration.loadProvinces();
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (registration.step < 4) {
      registration.continueFromStep();
      return;
    }
    void registration.beginVerification();
  };

  const primaryActionLabel = registration.selectedDocument?.method === "MANUAL"
    ? "Continue to manual verification"
    : "Start Didit verification";

  return (
    <main data-testid="registration-page" className="min-h-screen bg-background text-foreground">
      <header className="flex min-h-16 items-center justify-between border-b bg-card px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-md px-2 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Back to TrabaWho home">
          <img src="/trabawho-logo.svg" alt="" className="size-9" aria-hidden="true" />
          <span className="text-lg font-bold"><BrandWordmark /></span>
        </button>
        <Button type="button" variant="ghost" onClick={onBack} className="px-2 sm:px-4">
          <ArrowLeft aria-hidden="true" /> <span className="hidden sm:inline">Back to home</span><span className="sm:hidden">Back</span>
        </Button>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1.15fr)_minmax(30rem,0.85fr)]">
        <aside className="relative hidden min-h-[calc(100vh-4rem)] overflow-hidden bg-primary lg:block" aria-label="How TrabaWho registration works">
          <img
            src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1600&h=1600&fit=crop"
            alt="Local professionals planning work together"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(7,32,78,0.94),rgba(21,87,192,0.76),rgba(7,32,78,0.9))]" aria-hidden="true" />
          <div className="relative flex min-h-full flex-col justify-between p-10 text-white xl:p-14">
            <div className="max-w-xl pt-8">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-300">Verified from the start</p>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight xl:text-5xl">One registration flow for clients and workers.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-blue-50">Choose how you will use TrabaWho, secure your account, set your service location, and complete the identity path supported by your document.</p>
            </div>

            <ol className="grid max-w-xl gap-3" aria-label="Registration benefits">
              <li className="flex items-center gap-3 rounded-lg border border-white/20 bg-blue-950/45 p-4 backdrop-blur-sm"><UserRoundCheck className="size-5 text-orange-300" aria-hidden="true" /><span><strong className="block">One identity standard</strong><small className="text-blue-100">The same verification rules apply to clients and workers.</small></span></li>
              <li className="flex items-center gap-3 rounded-lg border border-white/20 bg-blue-950/45 p-4 backdrop-blur-sm"><ShieldCheck className="size-5 text-orange-300" aria-hidden="true" /><span><strong className="block">Document-aware verification</strong><small className="text-blue-100">Supported IDs use Didit; other government IDs receive manual review.</small></span></li>
              <li className="flex items-center gap-3 rounded-lg border border-white/20 bg-blue-950/45 p-4 backdrop-blur-sm"><MapPin className="size-5 text-orange-300" aria-hidden="true" /><span><strong className="block">Local service matching</strong><small className="text-blue-100">Province, city, and barangay choices keep nearby work relevant.</small></span></li>
            </ol>
          </div>
        </aside>

        <section className="min-w-0 bg-card px-4 py-8 sm:px-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:px-10 xl:px-14">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><BadgeCheck className="size-5" aria-hidden="true" /> Registration and identity verification</div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Create your account</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Complete each step, then verify your identity before account access is enabled.</p>
              <p className="mt-2 text-sm text-muted-foreground">Already registered? <button type="button" onClick={onLogin} className="min-h-11 rounded-md px-1 font-semibold text-primary underline-offset-4 hover:underline">Sign in</button></p>
            </div>

            {registration.phase === "form" ? (
              <form noValidate onSubmit={handleFormSubmit}>
                <RegistrationProgress currentStep={registration.step} onSelectStep={registration.goToStep} />

                {registration.step === 1 ? (
                  <RegistrationAccountStep
                    values={registration.values}
                    errors={registration.errors}
                    selectedDocument={registration.selectedDocument}
                    onAccountChange={(value) => registration.updateField("accountRole", value)}
                    onDocumentChange={(value) => registration.updateField("documentTypeKey", value)}
                  />
                ) : null}

                {registration.step === 2 ? (
                  <RegistrationSecurityStep values={registration.values} errors={registration.errors} onChange={registration.updateField} />
                ) : null}

                {registration.step === 3 ? (
                  <RegistrationLocationStep
                    values={registration.values}
                    errors={registration.errors}
                    location={registration.location}
                    onProvinceChange={(value) => { void registration.selectProvince(value); }}
                    onCityChange={(value) => { void registration.selectCity(value); }}
                    onBarangayChange={registration.selectBarangay}
                    onAddressChange={(value) => registration.updateField("address", value)}
                    onRetry={retryLocation}
                  />
                ) : null}

                {registration.step === 4 && registration.selectedDocument ? (
                  <RegistrationReviewStep
                    values={registration.values}
                    errors={registration.errors}
                    selectedDocument={registration.selectedDocument}
                    onConsentChange={(field, checked) => registration.updateField(field, checked)}
                    onEditStep={registration.goToStep}
                  />
                ) : null}

                {registration.submitError ? <div role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{registration.submitError}</div> : null}
                {registration.statusMessage ? <div role="status" aria-live="polite" className="mt-5 flex items-center gap-2 rounded-lg border bg-muted/50 p-4 text-sm"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{registration.statusMessage}</div> : null}

                <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-between">
                  {registration.step > 1 ? <Button type="button" variant="outline" onClick={registration.back}><ArrowLeft aria-hidden="true" /> Previous</Button> : <span />}
                  <Button type="submit" isLoading={registration.isSubmitting} className="sm:min-w-44">
                    {registration.isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : registration.step === 4 ? <ShieldCheck aria-hidden="true" /> : null}
                    {registration.step < 4 ? "Next" : primaryActionLabel}
                  </Button>
                </div>
              </form>
            ) : null}

            {registration.phase === "manual" && registration.selectedDocument ? (
              <form noValidate onSubmit={(event) => { event.preventDefault(); void registration.submitManualReview(); }}>
                <ManualIdentityStep documentLabel={registration.selectedDocument.label} values={registration.values} errors={registration.errors} onChange={registration.updateField} />
                {registration.submitError ? <div role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{registration.submitError}</div> : null}
                {registration.statusMessage ? <div role="status" aria-live="polite" className="mt-5 flex items-center gap-2 rounded-lg border bg-muted/50 p-4 text-sm"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{registration.statusMessage}</div> : null}
                <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-between">
                  <Button type="button" variant="outline" onClick={registration.back}><ArrowLeft aria-hidden="true" /> Back to review</Button>
                  <Button type="submit" isLoading={registration.isSubmitting} className="sm:min-w-44"><FileCheck2 aria-hidden="true" /> Submit manual review</Button>
                </div>
              </form>
            ) : null}

            {registration.phase === "didit" ? (
              <section data-testid="didit-session-panel" aria-labelledby="didit-heading" className="grid gap-5 rounded-xl border bg-muted/20 p-5 sm:p-7">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="size-6" aria-hidden="true" /></span>
                <div><h2 id="didit-heading" tabIndex={-1} className="text-2xl font-bold">Continue in Didit</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Didit will validate your document, perform liveness detection, and match your face. Return here afterward to check the result.</p></div>
                <a href={registration.identitySession?.verificationUrl || "#"} className={cn(buttonVariants({ variant: "primary" }), "w-full")}><ExternalLink aria-hidden="true" /> Open Didit verification</a>
                <Button type="button" variant="outline" onClick={() => { void registration.checkDiditStatus(); }} isLoading={registration.isSubmitting}><RefreshCw aria-hidden="true" /> Check verification status</Button>
                <Button type="button" variant="ghost" onClick={registration.restart}>Restart or choose manual review</Button>
                {registration.statusMessage ? <div role="status" aria-live="polite" className="rounded-lg border bg-card p-4 text-sm">{registration.statusMessage}</div> : null}
                {registration.submitError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{registration.submitError}</div> : null}
              </section>
            ) : null}

            {registration.phase === "outcome" && registration.outcome ? (
              <section data-testid="identity-outcome" aria-labelledby="registration-outcome-heading" className="grid gap-5 rounded-xl border bg-muted/20 p-5 text-center sm:p-8">
                <span className={cn("mx-auto flex size-14 items-center justify-center rounded-full", registration.outcome.kind === "failed" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                  {registration.outcome.kind === "failed" ? <XCircle className="size-7" aria-hidden="true" /> : <CheckCircle2 className="size-7" aria-hidden="true" />}
                </span>
                <div><h2 id="registration-outcome-heading" tabIndex={-1} className="text-2xl font-bold">{registration.outcome.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{registration.outcome.message}</p></div>
                {registration.outcome.kind === "failed" ? <Button type="button" onClick={registration.restart}><RefreshCw aria-hidden="true" /> Try another verification method</Button> : <Button type="button" onClick={onLogin}>Go to sign in</Button>}
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
