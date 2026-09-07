# Frontend Architecture Standard

## Platform

TrabaWho uses React 19, Vite, strict TypeScript, React Router, Tailwind CSS, shadcn/ui, Lucide React, Supabase, Vitest, Testing Library, and Playwright. New frontend JavaScript is prohibited. Legacy JavaScript is temporary and tracked in the active migration document.

## Project scope

- Current modernization work is frontend-only: interface structure, responsive behavior, accessibility, routing, client state, forms, presentation, and browser-side integration code.
- Supabase schemas, migrations, RLS policies, RPCs, Edge Functions, stored data, secrets, and backend infrastructure are read-only context unless the user explicitly authorizes a separate backend task.
- Frontend changes must preserve existing authentication and business behavior exposed by those backend interfaces.

## Source layout

```text
src/
  app/
    layouts/
    providers/
    router/
  components/
    layout/
    ui/
  features/
    feature-name/
      pages/
      components/
      hooks/
      services/
      types.ts
      index.ts
  integrations/
    supabase/
  lib/
  styles/
  types/
```

- Pages compose route-level screens.
- Feature components contain feature presentation only.
- Hooks/controllers own orchestration and transient UI state.
- Domain functions own validation, calculations, and state-transition rules.
- Services are the only feature layer that calls Supabase or another remote system.
- `components/ui` contains shadcn-based primitives with no product-specific knowledge.
- `components/layout` contains reusable application composition.

## Imports and boundaries

- Use relative imports within one small feature area. Use `@/*` for shared or cross-feature imports.
- A feature exposes its supported surface from `index.ts`. Other features must not deep-import its internals.
- Shared code must never import a feature.
- Presentation components must not call Supabase directly.
- Circular dependencies are prohibited.
- Prefer named exports. Default exports may remain only during legacy conversion.

## TypeScript

- `strict` remains enabled. Do not introduce `any`, `@ts-ignore`, or `@ts-nocheck` to bypass typing.
- Model unknown external values as `unknown` and narrow them at the boundary.
- Reuse the checked-in Supabase `Database` contract for database access.
- Put feature-specific contracts in the feature; promote a type to `src/types` only when multiple features genuinely share it.
- Component props, service input/output, route params, form values, and error shapes must be explicit.

## Routing and state

- URLs own navigation state that users may bookmark, refresh, or traverse with Back/Forward.
- Route guards enforce guest, authenticated, worker, and admin access. Hidden controls are not authorization.
- URL parameters identify selected records. Search parameters represent shareable filters. Local component state is reserved for ephemeral presentation.
- Server data remains in feature hooks/services. Do not duplicate authoritative server records into unrelated global state.
- Unsaved forms must warn before a route change when losing work would be harmful.

## Size and complexity

- Target no more than 500 lines per source file.
- Files from 501–600 lines require review and a clear single responsibility.
- Files over 600 lines fail the file-size check unless present in the shrinking legacy allowlist.
- Split by responsibility, not arbitrary line ranges.

## Data and errors

- Validate at form/domain and server boundaries.
- Map technical errors to safe, corrective user messages; log diagnostic detail without secrets.
- Never expose tokens, headers, raw database errors, or private identifiers.
- Async actions must prevent duplicate submission and represent loading, success, and failure.
