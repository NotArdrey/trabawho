# React, TypeScript, and shadcn Migration

Status: active

## Current checkpoint

- Vite, strict TypeScript for migrated files, Tailwind CSS, shadcn/ui configuration, Vitest, linting, file-size enforcement, typed route policy, and Vercel SPA deployment are active.
- The application shell, public navigation, landing experience, loading state, notifications, shared confirmation dialog, route contracts, Supabase integration contract, pricing utility, profile-photo utility, and feature entry points are typed.
- The landing page and authentication presentation follow the white-led light theme, blue-led dark theme, image-forward composition, selective orange accent, and no-glow rules. Authentication behavior remains legacy JavaScript pending its full TypeScript conversion.
- 55 frontend files are TypeScript; 78 legacy JavaScript/JSX files remain. Twelve legacy source files plus the legacy stylesheet remain over 600 lines.
- Static quality gate: 44 tests passing. Twenty landing/search Playwright checks pass across 390, 768, 1024, 1280, and 1440px, including 200% page scale, URL restoration, and light, dark, and system theme preferences.

## Checkpoints

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

## Compatibility rules

- Supabase schema, RPCs, Edge Functions, stored data, and business behavior remain unchanged.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are canonical. Legacy `REACT_APP_*` names remain accepted until deployment settings are migrated.
- Existing hash-based public links are accepted until their equivalent route has shipped.
- Existing CSS may remain only for screens not yet migrated.

## Legacy file-size allowlist

The machine-readable list is `scripts/legacy-file-size-allowlist.json`. Entries may only be removed or split; new entries require an explanation in this document. Migrated `.ts` and `.tsx` files are never automatically exempt.

## Removal criteria

Migration is complete when the frontend contains no `.js` or `.jsx` source files, `allowJs` is disabled, the allowlist is empty, feature imports use public entry points, all supported routes survive refresh and Back/Forward navigation, the legacy stylesheet is deleted, and the full quality gate plus client, worker, onboarding, and admin Playwright journeys pass.
