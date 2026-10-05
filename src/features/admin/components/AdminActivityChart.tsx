import { useId, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityPoint } from "../types/admin-activity";

interface Props {
  points: ActivityPoint[];
  series: "accounts" | "reviews";
  title: string;
  unavailable: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });

export function AdminActivityChart({ points, series, title, unavailable }: Props) {
  const id = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);
  const maximum = Math.max(1, ...points.map((point) => point[series]));
  const total = points.reduce((sum, point) => sum + point[series], 0);
  const activeDays = points.filter((point) => point[series] > 0).length;
  const visibleDays = [...points].reverse().filter((point) => showAllDays || point[series] > 0);
  const barWidth = Math.max(2, 540 / Math.max(1, points.length) - 2);

  return <Card className="min-w-0 overflow-hidden shadow-none">
    <CardHeader className="border-b bg-primary/5">
      <div className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" aria-hidden="true" /><CardTitle className="text-base">{title}</CardTitle></div>
      <p className="text-sm text-muted-foreground">{unavailable ? "Daily activity unavailable" : `${activeDays} active ${activeDays === 1 ? "day" : "days"} · Peak ${total ? maximum : 0} in one day`}</p>
    </CardHeader>
    <CardContent className="space-y-3 pt-4">
      {unavailable ? <p className="text-sm text-muted-foreground">This trend is unavailable. Refresh to retry.</p> : <>
        {total ? <svg viewBox="0 0 600 120" role="img" aria-labelledby={id} className="w-full text-primary">
          <title id={id}>{title}: {total} in this period, across {activeDays} active days. Highest daily count: {maximum}.</title>
          <line x1="30" y1="92" x2="570" y2="92" className="stroke-border" />
          {points.map((point, index) => <rect key={point.date} x={30 + index * 540 / points.length + 1} y={92 - point[series] / maximum * 72} width={barWidth} height={point[series] / maximum * 72} rx="2" fill="currentColor" />)}
          <text x="30" y="114" className="fill-muted-foreground text-[12px]">{points[0]?.date}</text>
          <text x="570" y="114" textAnchor="end" className="fill-muted-foreground text-[12px]">{points.at(-1)?.date}</text>
        </svg> : <div className="flex min-h-24 items-center justify-center rounded-lg bg-muted/40 px-4 text-center text-sm text-muted-foreground">No activity recorded in this period.</div>}
        <div className="border-t pt-3">
          <Button id={`${id}-toggle`} type="button" variant="ghost" className="w-full justify-between rounded-lg bg-muted/35 px-3 text-primary hover:bg-muted/70 hover:text-primary" aria-expanded={isExpanded} aria-controls={`${id}-breakdown`} onClick={() => setIsExpanded((value) => !value)}>
            <span className="flex min-w-0 items-center gap-2"><ListFilter aria-hidden="true" /><span className="truncate">{isExpanded ? "Hide daily breakdown" : "View daily breakdown"}</span></span>
            {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </Button>
          <div id={`${id}-breakdown`} role="region" aria-labelledby={`${id}-toggle`} hidden={!isExpanded} className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Newest first · Philippine dates</p>
              <div className="flex flex-wrap gap-2" aria-label={`${title} day filter`}>
                <Button type="button" variant={!showAllDays ? "primary" : "outline"} aria-pressed={!showAllDays} onClick={() => setShowAllDays(false)}>Activity only <span className="text-xs opacity-80">{activeDays}</span></Button>
                <Button type="button" variant={showAllDays ? "primary" : "outline"} aria-pressed={showAllDays} onClick={() => setShowAllDays(true)}>All days <span className="text-xs opacity-80">{points.length}</span></Button>
              </div>
            </div>
            {visibleDays.length ? <ol aria-label={`${title} daily counts`} className="max-h-72 divide-y overflow-y-auto rounded-lg border bg-background">
              {visibleDays.map((point) => <li key={point.date} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 text-sm">
                <time dateTime={point.date} className="font-medium text-foreground">{dateFormatter.format(new Date(`${point.date}T00:00:00Z`))}</time>
                <Badge variant={point[series] ? "default" : "secondary"} aria-label={`${point[series]} ${point[series] === 1 ? "event" : "events"}`}>{point[series]}</Badge>
              </li>)}
            </ol> : <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No activity days in this period. Choose All days to inspect every date.</p>}
          </div>
        </div>
      </>}
    </CardContent>
  </Card>;
}
