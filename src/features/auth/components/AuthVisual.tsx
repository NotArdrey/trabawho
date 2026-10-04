import { BriefcaseBusiness, CalendarCheck, Search } from 'lucide-react';

const capabilities = [
  { icon: Search, title: 'Find the help you need', detail: 'Explore services for your next job.' },
  { icon: CalendarCheck, title: 'Keep bookings in one place', detail: 'Follow each job from booking to completion.' },
  { icon: BriefcaseBusiness, title: 'Offer your own services', detail: 'Set up your service area and publish a gig.' },
];

export function AuthVisual() {
  return (
    <aside className="relative hidden min-w-0 overflow-hidden rounded-lg bg-primary lg:block" aria-label="TrabaWho marketplace preview">
      <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1400&h=1600&fit=crop"
        alt="Professionals collaborating around a table" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/60 to-slate-950/20" aria-hidden="true" />
      <div className="relative flex h-full flex-col justify-end gap-8 p-8 text-white xl:p-12">
        <div className="space-y-4">
          <span className="inline-flex rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold">Built for local work</span>
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">A clear connection.<br />A job well done.</h2>
          <p className="max-w-md text-base leading-7 text-white/90">Create one account to book local services and, when you’re ready, offer your own.</p>
        </div>
        <ul className="space-y-4 border-t border-white/25 pt-6">
          {capabilities.map(({ icon: Icon, title, detail }) => <li key={title} className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 space-y-1"><p className="text-sm font-semibold">{title}</p><p className="text-sm leading-6 text-white/85">{detail}</p></div>
          </li>)}
        </ul>
      </div>
    </aside>
  );
}
