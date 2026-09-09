# TrabaWho Engineering Instructions

All contributions must follow the standards indexed in [`docs/README.md`](docs/README.md).

- Preserve existing product behavior unless a change is explicitly requested.
- Organize work by feature and keep UI, orchestration, domain rules, and data access separate.
- Use strict TypeScript for all new source and migrate materially edited JavaScript/JSX slices in the same change. Use `@/*` imports across boundaries, Tailwind utilities, shadcn/ui primitives, and Lucide icons.
- Target WCAG 2.2 AA, visible keyboard focus, 44px touch targets, and responsive layouts at the documented widths.
- Keep source files at or below 500 lines. Files from 501–600 require a documented temporary exception; files above 600 are prohibited except for frozen, shrinking legacy baselines.
- Do not add component or page selectors to global CSS. `src/shared/styles/modern.css` is frozen legacy code and may only shrink.
- Run `npm run check` and the relevant Playwright journeys before considering work complete.

The canonical product and engineering standard takes precedence over feature-specific planning documents.
