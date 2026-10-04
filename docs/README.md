# TrabaWho Documentation

This directory contains the maintained standards and migration records for TrabaWho.

## Authority order

1. [`standards/application-design-engineering.md`](standards/application-design-engineering.md) — canonical product, UX, accessibility, architecture, and quality standard.
2. [`standards/frontend-architecture.md`](standards/frontend-architecture.md) — repository-specific frontend implementation rules.
3. [`standards/ui-design-system.md`](standards/ui-design-system.md) — TrabaWho visual language and shadcn/ui usage.
4. Feature requirements and migration documents.

When documents disagree, follow the highest applicable document and update the lower-level document in the same change.

## Active migration

- [`migrations/react-typescript-shadcn.md`](migrations/react-typescript-shadcn.md)

## Integrations

- [`integrations/locations.md`](integrations/locations.md) — booking location dropdowns and optional Google Maps address suggestions.
- [`integrations/email.md`](integrations/email.md) — Gmail SMTP and system notification delivery.
- [`integrations/didit.md`](integrations/didit.md) — identity signup, admin review, webhook security, deployment, and verification.
- [`integrations/supabase.md`](integrations/supabase.md) — local configuration, database-change boundaries, and concise troubleshooting.
- [`integrations/paymongo.md`](integrations/paymongo.md) — hosted card checkout, webhook security, deployment, and verification.

## Active roadmaps

- [`roadmaps/booking-transactions.md`](roadmaps/booking-transactions.md) — booking lifecycle, PayMongo integration, refunds, disputes, and provider payouts.
- [`roadmaps/admin-operations.md`](roadmaps/admin-operations.md) — admin support workflows, exception handling, moderation, and launch gates.

Superseded plans, temporary fixes, generated logs, and one-off diagnostic notes do not belong in the repository. Record active work in the migration ledger or the applicable maintained standard.
