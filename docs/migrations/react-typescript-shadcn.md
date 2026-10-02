# React, TypeScript, and shadcn Migration

Status: active

## Current checkpoint

- Vite, strict TypeScript for migrated files, Tailwind CSS, shadcn/ui configuration, Vitest, linting, file-size enforcement, typed route policy, and Vercel SPA deployment are active.
- The application shell, public navigation, landing experience, loading state, notifications, shared confirmation dialog, route contracts, Supabase integration contract, pricing utility, profile-photo utility, and feature entry points are typed.
- The landing page and authentication presentation follow the white-led light theme, blue-led dark theme, image-forward composition, selective orange accent, and no-glow rules. The main registration form, step validation, location lookups, consent dialog, password fields, and identity signup transport are strict TypeScript. The remaining authentication shell and login/identity outcome orchestration remain frozen legacy JavaScript pending conversion.
- Admin identity queue, evidence dialog, domain contracts, orchestration, and service access are strict TypeScript. Identity backend migrations and function deployment were explicitly authorized; address persistence, admin decisions, and protected evidence were rehearsed on the linked test project. See the [Didit integration guide](../integrations/didit.md).
- The machine-readable source and file-size allowlists record the remaining legacy paths and their shrinking baselines.
- Booking conversation loading, refresh, duplicate-send protection, and the message composer are strict TypeScript. The remaining `ChatWindow.jsx` presentation stays on its shrinking baseline. Pricing tests are migrated to TypeScript; payment checkout no longer displays the GCash preview.
- Worker profile/service mapping and message persistence are strict TypeScript. Payment preferences use `worker_profiles`; service editing preserves safe partial-save feedback. The optional schema audit checks browser and Edge Function contracts with read-only requests; see the [Supabase guide](../integrations/supabase.md).
- Marketplace booking and messaging orchestration is extracted into a strict TypeScript hook. Message opens chat directly, Book now opens schedule selection, and terms are reviewed when continuing from payment. The remaining browse page retains its shrinking legacy baseline.
- Booking-list orchestration and marketplace service normalization are strict TypeScript. Failed booking loads stop their skeletons and offer retry; each gig displays its own title. Support follow-ups show one timeline entry per operation and the latest recorded next step in the admin queue.
- Static quality gate: Vitest and standards-guard coverage run in `npm run check`. Responsive Playwright coverage targets 390, 768, 1024, 1280, and 1440px, including 200% page scale, URL restoration, and light, dark, and system theme preferences.

- Gig boost presentation, orchestration, validation, and data access are strict TypeScript. PayMongo replaces demo activation; paid campaign validation and marketplace discovery/ranking are extracted into typed slices. The profile legacy file is now below 500 lines. Backend migrations and payment function deployment are explicitly authorized for this task.

- Booking review persistence, booking/chat search matching, marketplace URL search, and activity refresh recovery are extracted into strict TypeScript. Legacy pages only wire these slices. Client and provider dashboards reconcile on realtime events, focus/connection recovery, and a 15-second visible-page interval. Admin analytics and searchable recorded audit sources use typed services with partial-failure feedback; no backend migration is required.

## Checkpoints

- Provider chat scope resolution and availability deletion are extracted into strict TypeScript. Unread dashboard actions retain standalone conversation targets and open the incoming inbox. My Work service deletion requires confirmation and retains booking/chat records; deleted listings do not trigger automatic service recreation. Deletion failures stay visible for retry.

- [x] Record the application, architecture, and UI standards.
- [x] Add Vite, TypeScript, Tailwind CSS, shadcn configuration, providers, semantic tokens, and typed primitive examples.
- [x] Replace state-only navigation with guarded React Router routes while retaining a legacy view adapter during screen migration.
- [ ] Migrate application shell, navigation, theme, and feedback.
- [ ] Migrate public authentication, identity registration, and seller onboarding. The landing and password-recovery pages are migrated.
- [ ] Migrate dashboard, marketplace, profile, and settings.
- [ ] Migrate bookings, messages, payments, reviews, and chatbot.
- [ ] Migrate worker and admin workflows.
- [ ] Remove legacy JavaScript, PropTypes, inline theme objects, duplicate primitives, legacy navigation, and legacy CSS.
- [ ] Disable `allowJs` and remove every legacy exception.

Each checkpoint must remain deployable and pass the applicable quality gates before the next checkpoint begins.

Marketplace filter state and matching now live in typed hooks/domain functions, including URL restoration, category metadata, location matching, pagination reset, and price sorting. Booking hub and list filters share typed domain rules for payment due, delivered work, terminal states, and cash approvals. Legacy pages retain compatibility wiring until their remaining orchestration and presentation migrate.

## Compatibility rules

- Supabase schema, RPCs, Edge Functions, stored data, and business behavior remain unchanged.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are canonical. Legacy `REACT_APP_*` names remain accepted until deployment settings are migrated.
- Existing hash-based public links are accepted until their equivalent route has shipped.
- Existing CSS may remain only for screens not yet migrated.

## Legacy file-size allowlist

The machine-readable baseline is `scripts/legacy-file-size-allowlist.json`. Every entry records its current line count. A legacy file may match or shrink from that baseline but may never grow; after shrinking, the baseline must be lowered in the same change. Files at or below 500 lines leave the list.

Files from 501–600 lines may use `scripts/file-size-exceptions.json` only with a justification, owner, and removal milestone. New and migrated files over 600 lines cannot be excepted.

The remaining JavaScript/JSX paths are recorded in `scripts/legacy-source-allowlist.json`. The list may only shrink. Approved stylesheets and the frozen legacy CSS baseline are recorded in `scripts/style-source-allowlist.json`.

## Removal criteria

Migration is complete when the frontend contains no `.js` or `.jsx` source files, `allowJs` is disabled, the allowlist is empty, feature imports use public entry points, all supported routes survive refresh and Back/Forward navigation, the legacy stylesheet is deleted, and the full quality gate plus client, worker, onboarding, and admin Playwright journeys pass.
