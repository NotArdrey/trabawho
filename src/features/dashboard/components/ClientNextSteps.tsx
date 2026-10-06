import { ArrowRight, CircleAlert, LifeBuoy, ListChecks, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { paths } from "@/app/router/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import type { ClientBookingAction, ClientCaseProgress } from "@/features/dashboard/domain/clientNextSteps";

interface ClientNextStepsProps {
  actions: readonly ClientBookingAction[];
  caseProgress: ClientCaseProgress | null;
  casesError: boolean;
  casesLoading: boolean;
  onRetryCases: () => void;
}

export function ClientNextSteps({ actions, caseProgress, casesError, casesLoading, onRetryCases }: ClientNextStepsProps) {
  if (!actions.length && !caseProgress && !casesError) return null;

  return <WorkflowPanel
    id="client-next-steps"
    icon={ListChecks}
    tone={actions.length || caseProgress?.attention ? "highlight" : "primary"}
    title="Your next steps"
    description="Only tasks and open cases that need a closer look."
    status={actions.length ? <Badge variant="brand">{actions.length} booking {actions.length === 1 ? "action" : "actions"}</Badge> : undefined}
    action={actions.length > 3 ? <Button asChild variant="outline"><Link to={`${paths.bookings}?scope=purchases&filter=action-needed`}>View all actions<ArrowRight aria-hidden="true" /></Link></Button>
      : caseProgress ? <Button asChild variant="outline"><Link to={paths.supportCases}>View cases<ArrowRight aria-hidden="true" /></Link></Button> : undefined}
  >
    {actions.length ? <ol className="divide-y" aria-label="Booking actions">
      {actions.slice(0, 3).map((action) => <li key={action.id}>
        <Link to={action.href} className="group flex min-h-16 items-center gap-3 px-4 py-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
          aria-label={`${action.title}: ${action.detail}`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-highlight-soft text-brand-highlight-foreground"><CircleAlert className="size-[18px]" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold leading-5 text-foreground">{action.title}</strong><span className="mt-1 block text-sm leading-5 text-muted-foreground">{action.detail}</span></span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
        </Link>
      </li>)}
    </ol> : null}
    {caseProgress ? <div className="border-t bg-primary/5">
      <p className="px-4 pt-4 text-xs font-semibold text-primary sm:px-5">Open case progress</p>
      <Link to={caseProgress.href} className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
        aria-label={`${caseProgress.title}: ${caseProgress.detail}`}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><LifeBuoy className="size-[18px]" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold leading-5 text-foreground">{caseProgress.title}</strong><span className="mt-1 block text-sm leading-5 text-muted-foreground">{caseProgress.detail}</span></span>
        {caseProgress.attention ? <Badge variant="warning" className="hidden shrink-0 sm:inline-flex">{caseProgress.attention === "reply" ? "Reply needed" : "New update"}</Badge> : null}
        <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
      </Link>
    </div> : null}
    {casesError ? <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm sm:px-5" role="status">
      <p className="text-muted-foreground">Support case progress could not be verified.</p>
      <Button type="button" variant="outline" className="min-h-11" disabled={casesLoading} onClick={onRetryCases}><RefreshCw aria-hidden="true" />Retry cases</Button>
    </div> : null}
  </WorkflowPanel>;
}
