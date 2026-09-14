# TrabaWho System Architecture

Status: current-state reference
Last reviewed: 2026-09-14

This document describes the deployed TrabaWho architecture represented by the repository. It is descriptive, while the standards in [`../README.md`](../README.md) remain prescriptive and take precedence when the implementation changes.

## 1. Architecture summary

TrabaWho is a client-rendered service-marketplace SPA deployed as static assets on Vercel. The browser communicates directly with Supabase for authentication, row-level-secured application data, storage, realtime notifications, and database RPCs. Supabase Edge Functions hold privileged integration logic for identity verification and AI assistance. PostgreSQL functions and triggers own booking invariants that must remain atomic or resistant to client tampering.

The system is a modular frontend backed by a managed Supabase application backend. It should remain one deployable product until traffic, team ownership, or reliability requirements justify splitting a bounded context into a separate service.

## 2. System context

```mermaid
flowchart LR
  guest[Guest]
  client[Client]
  worker[Service provider]
  admin[Administrator]

  app[TrabaWho web application<br/>React SPA on Vercel]
  supabase[Supabase project<br/>Auth, Postgres, Realtime, Storage, Edge Functions]
  didit[Didit identity verification]
  groq[Groq-compatible AI API]
  psgc[PSGC location API]
  qr[QR code image API]

  guest --> app
  client --> app
  worker --> app
  admin --> app
  app -->|JWT-authenticated API and realtime| supabase
  app -->|province, city, barangay lookup| psgc
  app -->|presentation-only QR images| qr
  app -->|redirected verification session| didit
  didit -->|signed webhook| supabase
  supabase -->|session and decision API| didit
  supabase -->|text, vision, and search inference| groq
```

### Trust boundaries

- The browser is untrusted. Route guards improve navigation but never grant authorization.
- Supabase Auth issues the session JWT; PostgreSQL RLS and guarded RPCs enforce data access.
- Edge Functions may use the service-role key only after validating the request, its actor, input, replay protection, and rate limits.
- Didit webhook payloads cross an external trust boundary and require signature and freshness checks.
- AI output is advisory. It cannot finalize bookings, payments, prices, identity decisions, or administrative actions.

## 3. Runtime containers

```mermaid
flowchart TB
  subgraph Browser[User browser]
    router[Router and role-aware shell]
    features[Feature modules<br/>auth, marketplace, bookings, work, profile, admin]
    controllers[Hooks and controllers]
    services[Feature and shared services]
    sdk[Typed Supabase integration]
    local[Ephemeral browser state<br/>URL, sessionStorage, localStorage]

    router --> features
    features --> controllers
    controllers --> services
    services --> sdk
    router <--> local
  end

  subgraph Vercel[Vercel]
    static[Versioned static assets]
    rewrite[SPA fallback rewrite]
    rewrite --> static
  end

  subgraph Supabase[Supabase]
    auth[Auth]
    api[PostgREST and database RPC]
    realtime[Realtime]
    storage[Object Storage]
    edge[Edge Functions]
    db[(PostgreSQL)]
    cron[pg_cron]

    auth --> db
    api --> db
    realtime --> db
    storage --> db
    edge --> auth
    edge --> db
    edge --> storage
    cron --> db
  end

  Browser -->|loads assets| Vercel
  sdk -->|anon key plus optional user JWT| auth
  sdk -->|RLS-protected queries and RPCs| api
  sdk -->|postgres_changes subscriptions| realtime
  sdk -->|scoped uploads and public URLs| storage
  sdk -->|function invocation| edge
```

## 4. Frontend module architecture

New and migrated code follows this dependency direction:

```mermaid
flowchart LR
  pages[Pages and route screens] --> components[Feature components]
  pages --> hooks[Hooks and controllers]
  components --> hooks
  hooks --> domain[Pure domain rules and validation]
  hooks --> featureServices[Feature services]
  featureServices --> integration[Supabase integration]
  components --> ui[Shared UI primitives]
  pages --> layout[Shared application layout]
  integration --> external[Remote systems]
```

Responsibilities:

| Layer | Owns | Must not own |
| --- | --- | --- |
| `src/app` | providers, URL routing, access-policy mapping, application composition | feature-specific business rules |
| `src/features/*/pages` | route-level screen composition | direct database access in migrated code |
| `src/features/*/components` | feature presentation and accessible interaction | cross-feature orchestration or authorization |
| `src/features/*/hooks` | async orchestration, transient UI state, loading and error states | persistent business invariants |
| `src/features/*/services` | Supabase queries, RPC calls, remote DTO mapping | React rendering |
| domain utilities | validation, pricing, allowed state transitions, deterministic calculations | I/O or React state |
| `src/components/ui` | shadcn-based, product-agnostic primitives | marketplace knowledge |
| `src/integrations/supabase` | configured client and generated/checked-in database contracts | feature-specific presentation |

The current application still uses `useAppNavigation` and `viewMap` as a compatibility adapter while legacy JavaScript screens migrate. This is an implementation bridge, not the target boundary. URL state and typed route policies are the long-term navigation authority.

## 5. Backend responsibilities

### Supabase Auth

- Email/password signup, login, password reset, session persistence, and token refresh.
- Auth events seed or promote application profile records through database triggers.
- Application roles live in profile data and are enforced at the database boundary, not trusted from client input.

### PostgreSQL and PostgREST

- Durable system of record for users, providers, services, schedules, bookings, conversations, messages, reviews, and identity workflows.
- RLS scopes records to owners, booking participants, public marketplace readers, or administrators.
- RPCs serialize booking creation and protect booking, payment, delivery, dispute, and completion transitions.
- Immutable booking audit events provide a server-owned history of sensitive workflow changes.

### Realtime

- The browser subscribes to booking, conversation, and message changes.
- Realtime accelerates UI updates only; an initial query and later refetch remain the recovery path.
- RLS remains the source of subscription visibility.

### Storage

| Bucket | Visibility | Purpose |
| --- | --- | --- |
| `profile-photos` | public URL after owner upload | profile avatars |
| `portfolio` | public URL after owner upload | provider portfolio media |
| `review-images` | public URL after reviewer upload | review evidence/media |
| `identity-manual` | private | identity document and selfie submissions |

### Edge Functions

| Function | Responsibility | Privilege boundary |
| --- | --- | --- |
| `create-didit-session` | create or inspect a Didit verification session and record the attempt | public-signup validation, nonce, rate limits; server secrets |
| `create-unverified-user` | reconcile verification results, create the Auth user/profile, and send confirmation | service-role writes after identity checks |
| `didit-webhook` | ingest Didit decisions idempotently | signed, fresh webhook; event deduplication |
| `manual-identity-review` | validate/upload manual documents, list the admin queue, and authorize review decisions | private storage and service-role records with an admin-role check |
| `verification-redirect` | safely return the user to the web application | strips sensitive API parameters |
| `trabawho-chatbot` | sanitize chat input, load bounded marketplace/booking context, call model fallbacks, and return structured assistance | provider API key and service-role access stay server-side |

#### Didit v3 integration contract

- Configure a published KYC workflow in the Didit Console with ID verification, liveness, and face matching. Store its stable UUID in `DIDIT_WORKFLOW_ID`; runtime code must not silently select or create a different workflow.
- `create-didit-session` calls `POST https://verification.didit.me/v3/session/` with `x-api-key`, a stable pseudonymous `vendor_data`, `callback_method: both`, and the selected Philippine document restriction through `expected_details` (`ID`, `P`, or `DL`).
- Required Edge Function secrets are `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `TRABAWHO_APP_URL`.
- Configure a public HTTPS Didit v3 webhook destination for `status.updated` and `data.updated`. The handler requires a fresh `X-Timestamp`, prioritizes the full-payload `X-Signature-V2`, deduplicates `event_id`, and re-fetches `/v3/session/{session_id}/decision/` before using a deprecated simple-signature payload.
- Treat the returned hosted `url` and embedded session token as secrets. The URL is stored only in the private verification session record and the registering browser's session state; logs redact it.
- The registration review explicitly identifies Didit as the verification provider and links its verification privacy notice and end-user terms before biometric capture.

## 6. Data domains

```mermaid
erDiagram
  AUTH_USER ||--|| PROFILE : owns
  PROFILE ||--o| WORKER_PROFILE : extends
  PROFILE ||--o| SELLER : publishes
  SELLER ||--o{ SERVICE : offers
  SERVICE_CATEGORY ||--o{ SERVICE : classifies
  SERVICE ||--o{ SERVICE_PHOTO : illustrates
  SELLER ||--o{ PORTFOLIO_ITEM : showcases
  SELLER ||--o{ SELLER_CERTIFICATION : holds
  SELLER ||--o{ SELLER_AVAILABILITY : defines
  SERVICE ||--o{ SERVICE_SLOT : schedules
  SERVICE ||--o{ BOOKING : booked_as
  SERVICE_SLOT ||--o{ BOOKING : reserves
  PROFILE ||--o{ BOOKING : buys_or_fulfills
  BOOKING ||--o| CONVERSATION : opens
  CONVERSATION ||--o{ MESSAGE : contains
  BOOKING ||--o{ REVIEW : permits
  SELLER ||--|| SELLER_RATING_AGGREGATE : summarizes
  BOOKING ||--o{ BOOKING_AUDIT_EVENT : records
  PROFILE ||--o{ VERIFICATION_SESSION : verifies
  PROFILE ||--o{ IDENTITY_DOCUMENT_CLAIM : claims
  MANUAL_IDENTITY_REVIEW ||--o{ IDENTITY_DOCUMENT_CLAIM : resolves
```

The diagram groups `auth.users` as `AUTH_USER` and omits some optional foreign-key detail for readability. The migration files are authoritative for exact columns, constraints, policies, and relationships.

## 7. Critical flows

### Booking creation and lifecycle

```mermaid
sequenceDiagram
  actor Buyer
  participant UI as Booking UI
  participant Service as Booking service
  participant DB as PostgreSQL RPC
  participant RT as Supabase Realtime
  actor Provider

  Buyer->>UI: choose service, slot, payment plan
  UI->>Service: submit validated request
  Service->>DB: create_service_booking
  DB->>DB: lock slot, verify capacity, create booking
  DB-->>Service: committed booking
  Service-->>UI: render authoritative state
  DB-->>RT: booking change
  RT-->>Provider: notification/update
  Provider->>DB: guarded delivery or payment RPC
  Buyer->>DB: guarded confirmation or dispute RPC
  DB->>DB: append booking_audit_events
```

Client-side code can propose a transition, but only database RPCs and triggers may commit sensitive lifecycle fields. The 15-minute `pg_cron` job auto-confirms eligible delivered bookings after rechecking payment, dispute, schedule version, and due time.

### Identity-first registration

```mermaid
sequenceDiagram
  actor User
  participant SPA as Registration UI
  participant Edge as Identity Edge Functions
  participant Didit
  participant Auth as Supabase Auth
  participant DB as PostgreSQL

  User->>SPA: choose account type and identity document
  User->>SPA: enter credentials and service location
  User->>SPA: review details and accept identity/privacy consent
  alt Didit-supported document
    SPA->>Edge: request Didit session with registration data
    Edge->>Didit: create verification session
    Didit-->>SPA: hosted verification redirect
    Didit->>Edge: signed decision webhook
  else Manual document
    User->>SPA: enter ID details and provide private evidence
    SPA->>Edge: submit manual identity review
    Edge->>Auth: create identity-gated pending user
    Edge->>DB: save profile location/consent and private review record
  end
  Edge->>DB: deduplicate identity claim and record attempt
  alt automatic approval
    Edge->>Auth: create approved unconfirmed user
    Edge->>DB: save verified profile, account type, and location
    Edge->>Auth: send confirmation email
  else manual review or Didit exception
    Edge->>DB: keep verification pending for admin review
  end
  Auth->>DB: promote confirmed approved profile
  SPA->>Auth: establish normal authenticated session
```

### AI assistance

```mermaid
sequenceDiagram
  actor User
  participant SPA as Floating chatbot
  participant Edge as trabawho-chatbot
  participant DB as Marketplace and booking data
  participant Model as Groq API

  User->>SPA: send bounded text and optional image
  SPA->>Edge: message history plus coarse page context
  Edge->>Edge: authenticate, sanitize, rate-limit
  Edge->>DB: load only bounded relevant context
  Edge->>Model: grounded prompt with model fallback
  Model-->>Edge: candidate answer
  Edge->>Edge: normalize response and confidence handling
  Edge-->>SPA: advice, matches, estimate, and sources
```

## 8. Deployment and configuration

```mermaid
flowchart LR
  git[Git repository] --> build[npm run build<br/>TypeScript plus Vite]
  build --> dist[dist static bundle]
  dist --> vercel[Vercel CDN]
  browser[Browser route] --> vercel
  vercel -->|rewrite all application routes| index[index.html]

  migrations[Versioned SQL migrations] --> postgres[Supabase PostgreSQL]
  functions[Supabase function sources] --> edge[Supabase Edge runtime]
  secrets[Supabase secrets] --> edge
```

Browser configuration is limited to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Service-role credentials, Didit credentials, webhook secrets, hashing/nonces, and Groq keys belong only in Supabase-managed secrets. The Vercel rewrite in `vercel.json` makes client-side routes refresh-safe.

## 9. Quality and operational model

- `npm run check` is the repository quality gate: typecheck, lint, unit/component tests, file-size policy, and production build.
- Playwright journeys cover the relevant user path separately and must run before a behavior change is complete.
- Safe user-facing errors are produced at feature boundaries; diagnostic detail must not include tokens, raw headers, document data, or private identifiers.
- Booking audit records and identity registration attempts provide domain-level auditability. There is no dedicated application observability backend documented in this repository, so production logging and alert ownership should be defined before higher-scale operation.
- Network failures must leave authoritative state in Supabase and allow a query/refetch recovery. Realtime events and AI responses are never the sole durable record.

## 10. Current constraints and evolution path

The architecture is intentionally documented as both the current system and the direction for ongoing migration.

1. Finish the JavaScript-to-strict-TypeScript migration and remove the `viewMap` compatibility adapter.
2. Move remaining direct Supabase calls out of pages/components and into feature services.
3. Regenerate or expand `database.types.ts` after backend migrations; it currently models the core marketplace tables but not every identity and booking-audit addition.
4. Keep booking/payment transitions database-centered. A real online payment provider must enter through a verified server webhook that calls the service-role-only payment RPC; the current UI identifies its GCash behavior as sandboxed.
5. Add structured monitoring for Edge Function failure rates, webhook rejection/replay, auth anomalies, booking RPC errors, cron health, and model-provider latency/cost.
6. Split services only at established domain boundaries. Identity, payments, or AI are the likely first candidates because they hold distinct secrets, failure modes, and compliance concerns.

## 11. Source map

- Frontend entry and shell: `src/main.tsx`, `src/App.tsx`
- Route policy: `src/app/router/routes.ts`
- Feature modules: `src/features/*`
- Supabase client contract: `src/integrations/supabase/*`
- Edge Functions: `supabase/functions/*`
- Database history and policy: `supabase/migrations/*`
- Vercel build and SPA routing: `vercel.json`
- Canonical engineering standards: `docs/standards/*`
