import { useId } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityPoint } from "../types/admin-activity";

export function AdminActivityChart({ points, series, title, unavailable }: { points: ActivityPoint[]; series: "accounts" | "reviews"; title: string; unavailable: boolean }) {
  const id = useId();
  const maximum = Math.max(1, ...points.map((point) => point[series]));
  const line = points.map((point, index) => `${20 + index / Math.max(1, points.length - 1) * 560},${150 - point[series] / maximum * 125}`).join(" ");
  const total = points.reduce((sum, point) => sum + point[series], 0);
  return <Card className="min-w-0"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3">
    {unavailable ? <p className="text-sm text-muted-foreground">This trend is unavailable. Refresh to retry.</p> : <>
      <svg viewBox="0 0 600 180" role="img" aria-labelledby={id} className="w-full text-primary">
        <title id={id}>{title}: {total} in this period. Highest daily count: {total ? maximum : 0}.</title>
        <line x1="20" y1="150" x2="580" y2="150" className="stroke-border" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <text x="20" y="174" className="fill-muted-foreground text-[12px]">{points[0]?.date}</text>
        <text x="580" y="174" textAnchor="end" className="fill-muted-foreground text-[12px]">{points.at(-1)?.date}</text>
      </svg>
      {!total && <p className="text-sm text-muted-foreground">No activity recorded in this period.</p>}
      <details><summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View daily counts</summary>
        <div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{title} by day, Philippine time</caption><thead><tr><th scope="col" className="p-2">Date</th><th scope="col" className="p-2 text-right">Count</th></tr></thead><tbody>{points.map((point) => <tr key={point.date} className="border-t"><td className="p-2">{point.date}</td><td className="p-2 text-right">{point[series]}</td></tr>)}</tbody></table></div>
      </details>
    </>}
  </CardContent></Card>;
}
