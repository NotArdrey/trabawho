# Frontend Architecture Standard

## Platform

TrabaWho uses React 19, Vite, strict TypeScript, React Router, Tailwind CSS, shadcn/ui, Lucide React, Supabase, Vitest, Testing Library, and Playwright. New frontend JavaScript is prohibited. A materially edited JavaScript or JSX slice must be migrated to TypeScript in the same change; trivial compatibility wiring may remain until its owning slice migrates. Legacy JavaScript is temporary and tracked by a shrinking machine-readable allowlist.

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
- New React source uses `.tsx`; non-React source uses `.ts`. Do not create `.js` or `.jsx` files.
- Static presentation belongs in Tailwind classes, not `style` props. A runtime-only value may use an inline style only with a narrowly scoped lint exception explaining why a utility cannot express it.

## Styling

- Tailwind utilities and semantic design tokens are the default styling API. Use `cn` for conditional composition and CVA for reusable variants.
- `src/styles/globals.css` contains only Tailwind imports, tokens, resets, focus/reduced-motion defaults, and truly application-wide rules.
- Component-specific and page-specific selectors are prohibited in global CSS.
- `src/shared/styles/modern.css` is frozen legacy compatibility code: no new selectors, no baseline growth, and migrated selectors must be deleted.
- A new stylesheet requires an exceptional machine-readable approval and is permitted only when a browser or third-party limitation cannot reasonably be represented with Tailwind.

## Routing and state

- URLs own navigation state that users may bookmark, refresh, or traverse with Back/Forward.
- Route guards enforce guest, authenticated, worker, and admin access. Hidden controls are not authorization.
- URL parameters identify selected records. Search parameters represent shareable filters. Local component state is reserved for ephemeral presentation.
- Server data remains in feature hooks/services. Do not duplicate authoritative server records into unrelated global state.
- Unsaved forms must warn before a route change when losing work would be harmful.

## Size and complexity

- Source files must remain at or below 500 lines by default.
- Files from 501–600 lines require a temporary machine-readable exception with a justification, owner, and removal milestone.
- New and migrated files over 600 lines are prohibited.
- Existing oversized JavaScript, JSX, and legacy CSS must match a frozen baseline, may never grow, and must ratchet downward until removed.
- Split by responsibility, not arbitrary line ranges.

## Data and errors

- Validate at form/domain and server boundaries.
- Map technical errors to safe, corrective user messages; log diagnostic detail without secrets.
- Never expose tokens, headers, raw database errors, or private identifiers.
- Async actions must prevent duplicate submission and represent loading, success, and failure.
