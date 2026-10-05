import { useId } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityPoint } from "../types/admin-activity";

export function AdminActivityChart({ points, series, title, unavailable }: { points: ActivityPoint[]; series: "accounts" | "reviews"; title: string; unavailable: boolean }) {
  const id = useId();
  const maximum = Math.max(1, ...points.map((point) => point[series]));
  const total = points.reduce((sum, point) => sum + point[series], 0);
  const activeDays = points.filter((point) => point[series] > 0).length;
  const barWidth = Math.max(2, 540 / Math.max(1, points.length) - 2);
  return <Card className="min-w-0 overflow-hidden shadow-none"><CardHeader className="border-b bg-primary/5"><div className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" aria-hidden="true" /><CardTitle className="text-base">{title}</CardTitle></div><p className="text-sm text-muted-foreground">{unavailable ? "Daily activity unavailable" : `${activeDays} active ${activeDays === 1 ? "day" : "days"} · Peak ${total ? maximum : 0} in one day`}</p></CardHeader><CardContent className="space-y-3 pt-4">
    {unavailable ? <p className="text-sm text-muted-foreground">This trend is unavailable. Refresh to retry.</p> : <>
      {total ? <svg viewBox="0 0 600 120" role="img" aria-labelledby={id} className="w-full text-primary">
        <title id={id}>{title}: {total} in this period, across {activeDays} active days. Highest daily count: {maximum}.</title>
        <line x1="30" y1="92" x2="570" y2="92" className="stroke-border" />
        {points.map((point, index) => <rect key={point.date} x={30 + index * 540 / points.length + 1} y={92 - point[series] / maximum * 72} width={barWidth} height={point[series] / maximum * 72} rx="2" fill="currentColor" />)}
        <text x="30" y="114" className="fill-muted-foreground text-[12px]">{points[0]?.date}</text>
        <text x="570" y="114" textAnchor="end" className="fill-muted-foreground text-[12px]">{points.at(-1)?.date}</text>
      </svg> : <div className="flex min-h-24 items-center justify-center rounded-lg bg-muted/40 px-4 text-center text-sm text-muted-foreground">No activity recorded in this period.</div>}
      <details><summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View daily counts</summary>
        <div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{title} by day, Philippine time</caption><thead><tr><th scope="col" className="p-2">Date</th><th scope="col" className="p-2 text-right">Count</th></tr></thead><tbody>{points.map((point) => <tr key={point.date} className="border-t"><td className="p-2">{point.date}</td><td className="p-2 text-right">{point[series]}</td></tr>)}</tbody></table></div>
      </details>
    </>}
  </CardContent></Card>;
}
