import { ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminLogsSection() {
  return <section className="space-y-5"><div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 className="mt-1 text-3xl font-bold">Audit logs</h1><p className="mt-2 text-muted-foreground">Platform-wide admin activity will appear here when an audit feed is connected.</p></div>
    <Card><CardContent className="flex flex-col items-start gap-3 p-6"><ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">Audit feed not available</h2><p className="text-sm text-muted-foreground">This page is not connected to platform audit events. An empty list would not mean that no actions occurred.</p></CardContent></Card>
  </section>;
}
