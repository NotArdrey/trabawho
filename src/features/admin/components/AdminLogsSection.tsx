import { FileClock, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminLog } from "@/features/admin/types";

interface AdminLogsSectionProps {
  logs: AdminLog[];
}

export default function AdminLogsSection({ logs }: AdminLogsSectionProps) {
  return (
    <section aria-labelledby="audit-logs-title">
      <Card className="shadow-none">
        <CardHeader className="border-b border-border">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileClock className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle id="audit-logs-title" className="text-2xl">Audit logs</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-6">
                Review sensitive administrator activity when audit records are available.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-6">
          {logs.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-5">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-semibold">No audit records available</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The current admin data source has not returned an audit history. No activity has been inferred.
                </p>
              </div>
            </div>
          ) : (
            <ol className="space-y-3">
              {logs.map((log) => (
                <li key={log.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{log.action}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Actor: <span className="font-medium text-foreground">{log.actor}</span> · Target:{" "}
                        <span className="font-medium text-foreground">{log.target}</span>
                      </p>
                    </div>
                    <Badge variant={log.severity === "high" ? "destructive" : log.severity === "medium" ? "warning" : "secondary"}>
                      {log.severity}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{log.timestamp}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
