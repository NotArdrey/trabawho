# TrabaWho UI Design System

## Direction

The interface is professional, modern, approachable, and trustworthy. Preserve the TrabaWho blue/orange identity while using neutral surfaces and semantic shadcn/ui tokens. Clarity and task completion take precedence over decoration, but restraint must not result in generic, colorless, or visually forgettable screens.

Visual interest must reinforce hierarchy or explain the product. Use brand color, relevant photography, simple line artwork, numbered steps, and structured information panels intentionally. Avoid empty decoration and dense promotional clutter.

## Foundation

- Use shadcn/ui source components in `src/components/ui`; do not introduce a competing component library.
- Use Tailwind utilities and semantic tokens. Static `style` props and component-specific rules in global stylesheets are prohibited. Use `cn` for conditional utilities and CVA for reusable component variants.
- Keep global CSS limited to Tailwind setup, design tokens, resets, and universal accessibility behavior. Legacy global selectors may only be removed during migration, never extended.
- Use Lucide React for interface icons. Do not use emoji, text glyphs, or one-off SVGs for ordinary controls.
- Use Inter/system sans-serif for interface text and monospace only for technical values.
- Use the spacing scale `4, 8, 12, 16, 24, 32, 48, 64` and a default 8px radius.

## Brand and semantic color

- Primary brand: `#1557c0`; stronger interactive state: `#0f4396`.
- Brand highlight: `#ff7a00`; strong orange surface: `#b45309`; accessible highlight text: `#9a3412`; soft highlight surface: `#fff3e6`. Components consume semantic highlight tokens instead of raw orange utilities. Orange count surfaces use the strong tone with white text; never pair bright orange with black text.
- Light mode is white-led: use white and subtle cool-neutral surfaces, TrabaWho blue for primary actions and navigation, and orange for compact highlights.
- Dark mode is blue-led: use deep navy and dark blue surfaces rather than flat black or neutral gray, with accessible lighter blue interactions and selective orange highlights.
- Blue remains the dominant interactive color for primary buttons, links, focus rings, navigation text, and confirmed selections. Orange is limited to rating stars, attention and unread counts, selected mobile-filter chips, small active-navigation indicators, required markers, and compact provider or marketplace icons.
- Do not use orange-filled primary buttons. The bright logo orange does not provide sufficient contrast with white button text. Destructive, success, and warning treatments retain their own semantic colors; the `brand` badge variant is not a warning variant.
- Do not place a contrasting color on only one edge of a card, panel, field, or alert. Borders remain uniform on all sides; place brand emphasis inside the component instead.
- A page should contain enough blue/orange brand expression to be recognizably TrabaWho without coloring every surface.
- Components consume `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, and `ring` tokens.
- Dark mode changes semantic tokens, not component markup.
- Never communicate status with color alone.

## Layout and imagery

- Use image-forward editorial layouts for public acquisition, authentication, and onboarding when photography helps establish the service context.
- On wide authentication-style screens, prefer an approximately 55–60% visual column and 40–45% task column. The form remains readable and independently scrollable when its content is long.
- Use one strong, relevant image rather than multiple competing photographs. Apply a restrained overlay only to maintain text contrast.
- Text placed over photography needs a deliberate content block or clearly controlled contrast. Supporting benefits must be visually noticeable, concise, and structured rather than presented as faint miscellaneous text.
- Decorative visuals must never block interaction, reduce legibility, or create horizontal overflow. Hide or substantially simplify nonessential photography on small screens so the user reaches the task immediately.
- Do not present invented marketplace statistics, ratings, verification, availability, or trust claims. When real data is unavailable, use truthful capability statements or omit the claim.

## Components

- Buttons use `primary`, `secondary`, `outline`, `ghost`, or `destructive`; one task state has one dominant primary action.
- Do not use neon borders, colored or luminous shadows, animated shine, glow-on-hover, or glow-based focus treatments. Establish hierarchy with spacing, typography, surface contrast, borders, and restrained neutral shadows.
- Hover states may change color or border contrast but must not lift, scale, or add decorative radiance. Keyboard focus remains a clear solid ring with adequate contrast.
- Icon-only buttons have a minimum 44×44px hit area, a programmatic name, and a tooltip when the action is not universally obvious.
- Forms use persistent labels, optional format/example copy, nearby corrective errors, and `aria-describedby` associations.
- Use the shared shadcn-based `SelectField` for standard dropdown fields. Extend the shared API for recurring needs instead of creating page-specific select styling; use lower-level Select primitives only for deliberately custom composition.
- Notification centers use the shared shadcn-based popover and notification-list components. Keep persistent inbox items distinct from transient Sonner feedback, show honest unread state, and include loading, empty, and recoverable error handling when data is remote.
- Long forms are divided into short, named or numbered sections with brief supporting copy. Standalone authentication and onboarding panels may include the TrabaWho lockup and compact brand accents so they do not feel generic or unfinished.
- Registration uses a short step flow with visible progress, per-step validation, and Previous/Next navigation. Every step uses the same section-heading treatment; do not introduce a one-off card for an individual step.
- Use blue for the active form mode and primary submit action. Use orange only as a supporting accent for progress, identity, location, or other important contextual information.
- Information panels use flat semantic surfaces and clear borders. They must not use luminous gradients or shadow effects to attract attention.
- Operational regions use the shared workflow-panel primitives so users can recognize purpose without rereading the full panel. Each panel has an icon-led tinted header, a clear title and description, optional text-backed status, one content region, and at most one primary contextual action.
- Workflow panels use a single outer boundary. Separate rows, statistics, actions, and empty states with spacing, surface contrast, and dividers rather than nested bordered cards.
- Empty workflow states name the current condition, explain what will appear there, and show one contextual action only when the user has a useful next step. Desktop panel actions sit in the header; on mobile they move below the relevant content.
- Dialogs trap focus and restore it. Destructive decisions use Alert Dialog and name the affected record.
- Use inline feedback for form/section outcomes, transient notifications for routine success, and banners only for ongoing conditions.
- Data regions explicitly handle initial loading, empty, partial, success, recoverable error, permission-denied, and offline states.

## Responsive composition

Design and verify at 390, 768, 1024, 1280, and 1440 pixels. Recompose rather than shrink desktop layouts. Flexible children use `min-width: 0`; essential identifiers and calculated values wrap instead of truncating. Scrolling regions keep visible scrollbars, except compact horizontal chip rails may hide them when native touch scrolling, pointer dragging, keyboard access, and automatic selected-item visibility are all preserved.

## Accessibility

Target WCAG 2.2 AA. Require semantic landmarks and headings, complete keyboard operation, logical focus order, visible focus, accessible names, associated errors, polite status announcements, reduced-motion support, adequate contrast, zoom/large-text support, and keyboard alternatives for drag operations.

Decorative Lucide icons use `aria-hidden="true"`. Meaningful graphics require an accessible name or adjacent text. Tooltips supplement rather than replace accessible names.

## Content

Use concise language familiar to clients and workers. Actions begin with verbs. Error messages explain what must be corrected. Use the same term for the same concept throughout the product and maintain English and Filipino strings together when a screen is localized.
