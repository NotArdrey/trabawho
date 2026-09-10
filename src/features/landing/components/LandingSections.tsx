import {
  CalendarCheck,
  CheckCircle2,
  ArrowRight,
  MessageSquareText,
  Search,
  ShieldCheck,
  Tags,
  UserRoundSearch,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Provider information",
    description: "Review profile details and any available verification status before choosing a provider.",
  },
  {
    icon: Tags,
    title: "Clear service details",
    description: "Compare descriptions, pricing models, locations, and reviews shared on each listing.",
  },
  {
    icon: CalendarCheck,
    title: "Booking support",
    description: "Use available schedules or contact the provider when a service requires coordination.",
  },
];

const steps = [
  { icon: Search, title: "Search", description: "Tell us what service you need and where you need it." },
  { icon: UserRoundSearch, title: "Compare", description: "Review providers, rates, feedback, and scheduling options." },
  { icon: MessageSquareText, title: "Connect and book", description: "Message your chosen provider and complete the booking flow." },
];

interface LandingSectionsProps {
  onBecomeProvider: () => void;
}

export default function LandingSections({ onBecomeProvider }: LandingSectionsProps) {
  return (
    <>
      <section className="border-y bg-muted/35 py-14 sm:py-16" aria-labelledby="trust-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Designed for informed choices</p>
            <h2 id="trust-title" className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              Important details, easier to review
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {trustItems.map(({ icon: Icon, title, description }) => (
              <article className="rounded-xl border bg-card p-6 transition-shadow duration-300 hover:shadow-md" key={title}>
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" aria-hidden="true" /></span>
                <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20" id="how-it-works" aria-labelledby="how-it-works-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">Simple from the start</p>
            <h2 id="how-it-works-title" className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              How TrabaWho works
            </h2>
          </div>
          <ol className="relative mt-10 grid gap-8 md:grid-cols-3">
            <span className="absolute left-[16.66%] right-[16.66%] top-6 hidden h-px bg-gradient-to-r from-primary/20 via-brand-highlight/60 to-primary/20 md:block" aria-hidden="true" />
            {steps.map(({ icon: Icon, title, description }, index) => (
              <li className="relative text-center" key={title}>
                <span className="relative mx-auto flex size-12 items-center justify-center rounded-full border bg-background text-primary shadow-sm ring-4 ring-background">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-primary">Step {index + 1}</p>
                <h3 className="mt-1 text-lg font-bold text-foreground">{title}</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-20" aria-labelledby="provider-cta-title">
        <div className="relative isolate mx-auto flex max-w-7xl flex-col justify-between gap-8 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-10 text-primary-foreground shadow-xl shadow-primary/10 sm:px-10 lg:flex-row lg:items-center">
          <div className="pointer-events-none absolute -right-16 -top-24 -z-10 size-80 rounded-full bg-brand-highlight/25 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm">
              <CheckCircle2 className="size-4 text-brand-highlight" aria-hidden="true" /> For local professionals
            </span>
            <h2 id="provider-cta-title" className="mt-3 text-3xl font-bold tracking-tight">
              Turn your skills into opportunities.
            </h2>
            <p className="mt-3 leading-7 text-primary-foreground/85">
              Create your account, complete provider onboarding, and present your services to potential clients.
            </p>
          </div>
          <Button className="group relative isolate self-start overflow-hidden border-0 bg-background px-6 text-primary shadow-lg hover:bg-background focus-visible:ring-white" size="lg" onClick={onBecomeProvider}>
            <span className="absolute inset-y-0 -left-16 -z-10 w-10 -skew-x-12 bg-gradient-to-r from-transparent via-brand-highlight-soft to-transparent transition-transform duration-700 group-hover:translate-x-[18rem] group-focus-visible:translate-x-[18rem] motion-reduce:hidden" aria-hidden="true" />
            <span className="relative">Become a service provider</span>
            <ArrowRight className="relative transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
          </Button>
        </div>
      </section>
    </>
  );
}
