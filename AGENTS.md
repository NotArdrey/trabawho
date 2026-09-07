# TrabaWho Engineering Instructions

All contributions must follow the standards indexed in [`docs/README.md`](docs/README.md).

- Preserve existing product behavior unless a change is explicitly requested.
- Organize work by feature and keep UI, orchestration, domain rules, and data access separate.
- Use strict TypeScript for new and migrated code, `@/*` imports across boundaries, shadcn/ui primitives, and Lucide icons.
- Target WCAG 2.2 AA, visible keyboard focus, 44px touch targets, and responsive layouts at the documented widths.
- Keep files at or below 500 lines when practical; files above 600 lines require an explicit temporary legacy exception.
- Run `npm run check` and the relevant Playwright journeys before considering work complete.

The canonical product and engineering standard takes precedence over feature-specific planning documents.
