import type { LucideIcon } from "lucide-react";
import { CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminSectionPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  scope: readonly string[];
}

export default function AdminSectionPlaceholder({
  icon: Icon,
  title,
  description,
  scope,
}: AdminSectionPlaceholderProps) {
  return (
    <section aria-labelledby="admin-placeholder-title">
      <Card className="overflow-hidden shadow-none">
        <CardHeader className="border-b border-border bg-muted/35">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle id="admin-placeholder-title" className="text-2xl">{title}</CardTitle>
                <CardDescription className="max-w-2xl leading-6">{description}</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <CircleDashed className="size-3.5" aria-hidden="true" />
              Data connection pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 py-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)]">
          <div>
            <h2 className="text-base font-semibold">Planned workspace</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {scope.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--brand-orange)]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5">
            <h2 className="text-base font-semibold">Why this is unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This area needs a verified live data contract, server-enforced permissions, and audit coverage before management actions can be enabled.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
