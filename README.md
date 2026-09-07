# TrabaWho

TrabaWho is a React marketplace for connecting customers with local service providers. It combines booking and seller workflows with an AI assistant that can use marketplace and booking context to help users find services, estimate requirements, and understand their options.

Production: https://trabawho-kappa.vercel.app

## Implemented features

- Customer dashboard, service discovery, profiles, bookings, work tracking, settings, and seller onboarding
- Booking schedules, recurring billing rules, payment-method restrictions, proof-of-payment flows, and transaction status controls
- Responsive light/dark interface with English and Filipino language support
- Supabase-backed authentication, application data, storage, and Edge Functions
- AI chatbot with authenticated product context, text and image input, model fallbacks, request limits, low-confidence handling, and sanitized provider errors
- PDF generation with jsPDF
- Playwright end-to-end coverage for desktop/mobile layouts, authentication restrictions, loading and failure states, request context, console errors, and layout overflow

## Technology

- React 19, Vite, and TypeScript (incremental migration)
- Tailwind CSS and shadcn/ui with Lucide React icons
- React Router
- Supabase JavaScript client and Edge Functions
- Groq-compatible AI models
- Vitest, Playwright, and React Testing Library
- jsPDF and Lucide React

## Engineering standards

The canonical application, architecture, UI, accessibility, and testing requirements are indexed in [`docs/README.md`](docs/README.md). The active TypeScript and shadcn migration is tracked in [`docs/migrations/react-typescript-shadcn.md`](docs/migrations/react-typescript-shadcn.md).

## Local development

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and provide only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the browser. Keep model-provider keys, Supabase service-role keys, and other privileged credentials in Supabase Edge Function secrets.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run test:e2e
npm run build
```

AI suggestions are assistance only. Final booking, payment, pricing, and provider decisions remain under user or administrator control.
