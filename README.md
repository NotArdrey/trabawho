# GigLink

GigLink is a React marketplace for connecting customers with local service providers. It combines booking and seller workflows with an AI assistant that can use marketplace and booking context to help users find services, estimate requirements, and understand their options.

## Implemented features

- Customer dashboard, service discovery, profiles, bookings, work tracking, settings, and seller onboarding
- Booking schedules, recurring billing rules, payment-method restrictions, proof-of-payment flows, and transaction status controls
- Responsive light/dark interface with English and Filipino language support
- Supabase-backed authentication, application data, storage, and Edge Functions
- AI chatbot with authenticated product context, text and image input, model fallbacks, request limits, low-confidence handling, and sanitized provider errors
- PDF generation with jsPDF
- Playwright end-to-end coverage for desktop/mobile layouts, authentication restrictions, loading and failure states, request context, console errors, and layout overflow

## Technology

- React 19 and Create React App
- Supabase JavaScript client and Edge Functions
- Groq-compatible AI models
- Playwright and React Testing Library
- jsPDF and Lucide React

## Local development

```bash
npm install
npm run dev
```

Create the required local environment file from the available example or project configuration and provide only the public Supabase URL and publishable/anonymous key to the browser. Keep model-provider keys, Supabase service-role keys, and other privileged credentials in Supabase Edge Function secrets.

## Verification

```bash
npm test
npm run test:e2e
npm run build
```

AI suggestions are assistance only. Final booking, payment, pricing, and provider decisions remain under user or administrator control.
